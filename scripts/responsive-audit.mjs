// Responsive audit: renders every main screen at phone, tablet and desktop sizes
// (plus a phone with text at 200%) in headless Chrome against a mocked API, and
// reports layout problems that jsdom can't see.
//
//   npm run audit:responsive
//   npm run audit:responsive -- --screens=c-menu,c-cart --viewports=320,390-text200
//   npm run audit:responsive -- --delay=1500   (also screenshot each page while
//                                               its data loads, as *-loading.png)
//   The checkout (c-checkout) shows Stripe's real card form, its Card row
//   opened, when .env has VITE_STRIPE_PUBLISHABLE_KEY (nothing is created at
//   Stripe until Pay, which the audit never presses); without a key, PayPal's
//   button, as the sheet shows it then.
//
// Needs Google Chrome installed (playwright-core drives it, no browser download);
// point CHROME_PATH at another Chromium to use that instead. Writes
// responsive-report/report.md, report.json and one screenshot per screen and
// viewport. Exits 1 when an error-level check fails:
//   - overflow: something sticks out sideways past the screen edge
//   - spill:    something sticks out of the card, sheet or dialog it sits in
//   - target:   a control under 24px (WCAG 2.5.8), links inside a sentence excepted
//   - covered:  content hidden under a fixed header or bottom bar
// Warnings (reported, never fatal): controls under 44×32 (both sides under
// 44px, or one under 32px), inline links under 24px,
// text under 12px, stretched images, sheets or dialogs whose content has to
// be scrolled, runtime errors on the page.
// Also errors: an id used twice (it breaks label and ARIA links), a control
// reached with Tab that ends up under a fixed header or bottom bar, a page
// without exactly one main region and one h1, and layout shift (CLS) over 0.1
// while the page loads.

import { chromium } from "playwright-core"
import { createServer, loadEnv } from "vite"
import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const OUT = path.join(ROOT, "responsive-report")
const fixtures = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scripts/responsive-fixtures.json"), "utf8")
)

// [id, role (null = signed out), url, action]. The action opens a sheet or
// dialog; those screens are audited inside it.
const SCREENS = [
  ["c-home", "customer", "/", null],
  ["c-login", null, "/login", null],
  ["c-register", null, "/register", null],
  ["c-shop-notable", "customer", "/customer/shop/s1", null],
  ["c-tables-sheet", "customer", "/customer/shop/s1", "tables"],
  ["c-menu", "customer", "/shops/s1/tables/t1", null],
  ["c-cart", "customer", "/shops/s1/tables/t1/cart", null],
  ["c-checkout", "customer", "/shops/s1/tables/t1/cart", "checkout"],
  ["c-account", "customer", "/myAccount", null],
  ["c-account-edit", "customer", "/myAccount", "editAccount"],
  ["m-shops", "shopMg", "/", null],
  ["m-shop", "shopMg", "/shop/s1", null],
  ["m-shop-edit", "shopMg", "/shop/s1", "editShop"],
  ["m-item-add", "shopMg", "/shop/s1", "addItem"],
  ["m-table-add", "shopMg", "/shop/s1", "addTable"],
  ["m-table-sheet", "shopMg", "/shop/s1", "viewTable"],
  ["m-refund", "shopMg", "/shop/s1", "refundPicker"],
  ["m-refund-other", "shopMg", "/shop/s1", "refundOther"],
  ["m-account", "shopMg", "/myAccount", null],
]

const VIEWPORTS = [
  { name: "320", width: 320, height: 640, mobile: true },
  { name: "360", width: 360, height: 740, mobile: true },
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "landscape", width: 740, height: 360, mobile: true },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "1024", width: 1024, height: 768, mobile: false },
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "390-text200", width: 390, height: 844, mobile: true, text: 2 },
]

const ACTIONS = {
  tables: (p) => p.getByRole("button", { name: /select table/i }).first(),
  checkout: (p) => p.getByRole("button", { name: /check ?out/i }).first(),
  editAccount: (p) => p.getByRole("button", { name: /edit profile/i }).first(),
  editShop: (p) => p.getByRole("button", { name: /edit details/i }).first(),
  addItem: (p) => p.getByRole("button", { name: /add menu item/i }).first(),
  addTable: (p) => p.getByRole("button", { name: /add table/i }).first(),
  viewTable: (p) => p.getByRole("button", { name: /view table/i }).first(),
  refundPicker: (p) => [
    p.getByRole("button", { name: /view table/i }).first(),
    p.getByRole("button", { name: /^refund items from/i }).first(),
  ],
  // The picker with Other chosen, which adds the note.
  refundOther: (p) => [
    ...ACTIONS.refundPicker(p),
    () => p.getByRole("combobox", { name: "Reason" }).first().selectOption("other", { timeout: 5000 }),
  ],
}

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3).split(",").filter(Boolean) : null
}
const pick = (all, names, key, flag) => {
  if (!names) return all
  const unknown = names.filter((n) => !all.some((x) => key(x) === n))
  if (unknown.length) {
    console.error(`Unknown --${flag}: ${unknown.join(", ")}. Known: ${all.map(key).join(", ")}`)
    process.exit(2)
  }
  return all.filter((x) => names.includes(key(x)))
}
const screens = pick(SCREENS, arg("screens"), (s) => s[0], "screens")
const viewports = pick(VIEWPORTS, arg("viewports"), (v) => v.name, "viewports")
// Milliseconds every mocked API answer is held back, to see loading states.
const DELAY = Number(arg("delay")?.[0] ?? 0)

// ---------------------------------------------------------------- in-page checks
// Runs inside the page, so it must be self-contained.
function audit() {
  const vw = document.documentElement.clientWidth
  const vh = innerHeight
  const visible = (el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && parseFloat(cs.opacity) > 0.05
  }
  const desc = (el) => {
    const label = el.labels && el.labels[0]
    const t = (el.getAttribute("aria-label") || (label && label.textContent) || el.textContent || el.getAttribute("placeholder") || el.name || el.type || "")
      .toString().trim().replace(/\s+/g, " ").slice(0, 40)
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : []
    return `${el.tagName.toLowerCase()}${cls.map((c) => "." + c).join("")}${t ? ` "${t}"` : ""}`
  }
  const hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())

  // With a sheet or dialog open, only it can be used; audit inside it.
  const layer = document.querySelector(".modal.show, .offcanvas.show")
  const scope = layer || document.body

  // Overflow: outermost elements past either screen edge, ignoring those inside
  // something that clips or scrolls sideways (deliberate, e.g. the shop name).
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement)
      if (getComputedStyle(p).overflowX !== "visible") return true
    return false
  }
  const over = []
  for (const el of scope.querySelectorAll("*")) {
    if (!visible(el) || clipped(el)) continue
    const r = el.getBoundingClientRect()
    if ((r.right > vw + 1 || r.left < -1) && !over.some((o) => o.el.contains(el))) over.push({ el, r })
  }

  // Spills: something wider than the card, sheet or dialog it sits in (still on
  // screen, so the overflow check misses it), e.g. a stepper past a card edge.
  const spills = []
  for (const box of scope.querySelectorAll(".card, .modal-content, .offcanvas")) {
    if (!visible(box)) continue
    const b = box.getBoundingClientRect()
    for (const el of box.querySelectorAll("*")) {
      // Only what can be seen counts: text, controls, images, canvases. Layout boxes
      // poke out harmlessly (a Bootstrap .row's negative margins are cancelled
      // by its columns' padding).
      if (!visible(el) || getComputedStyle(el).position === "fixed") continue
      if (!hasOwnText(el) && !el.matches("button, input, select, textarea, img, svg, canvas, video, a")) continue
      let scroller = false
      for (let p = el.parentElement; p && p !== box; p = p.parentElement)
        if (getComputedStyle(p).overflowX !== "visible") { scroller = true; break }
      if (scroller) continue
      const r = el.getBoundingClientRect()
      if ((r.right > b.right + 1 || r.left < b.left - 1) && !spills.some((s) => s.el.contains(el)))
        spills.push({ el, text: `${desc(el)} sticks out of its ${box.classList.contains("card") ? "card" : "panel"} (${Math.round(r.left)}..${Math.round(r.right)}px, box ${Math.round(b.left)}..${Math.round(b.right)}px)` })
    }
  }

  // Tap targets. The size that counts is what responds to a tap: the element,
  // a <label> wrapped around an input, or an absolutely positioned ::before or
  // ::after used to enlarge the hit area.
  const hitSize = (el) => {
    const r = el.getBoundingClientRect()
    let w = r.width, h = r.height
    const label = el.matches("input") && el.closest("label")
    if (label) {
      const l = label.getBoundingClientRect()
      w = Math.max(w, l.width); h = Math.max(h, l.height)
    }
    for (const [node, ps] of [el, label].filter(Boolean).flatMap((n) => [[n, "::before"], [n, "::after"]])) {
      const cs = getComputedStyle(node, ps)
      if (cs.content === "none" || cs.content === "normal" || cs.position !== "absolute") continue
      w = Math.max(w, parseFloat(cs.width) || 0); h = Math.max(h, parseFloat(cs.height) || 0)
    }
    return { w: Math.round(w), h: Math.round(h) }
  }
  // WCAG 2.5.8 exempts links within a sentence: an inline <a> whose parent
  // carries text of its own.
  const inlineLink = (el) => el.matches("a") && getComputedStyle(el).display === "inline" && !!el.parentElement && hasOwnText(el.parentElement)
  const targets = []
  const sel = "a[href], button, input:not([type=hidden]), select, textarea, [role=switch], [role=button], [role=checkbox]"
  // Visually hidden controls (a skip link until it's focused) aren't tapped.
  const hidden = ".visually-hidden, .visually-hidden-focusable:not(:focus):not(:focus-within)"
  for (const el of scope.querySelectorAll(sel)) {
    if (!visible(el) || el.closest("[aria-hidden=true]") || el.matches(hidden)) continue
    const { w, h } = hitSize(el)
    // Comfortable: at least 44 on one side and 32 on the other (a full-width
    // 38px button is easy to hit; a 31px square is not).
    const min = Math.min(w, h)
    if (Math.max(w, h) >= 44 && min >= 32) continue
    targets.push({ d: desc(el), w, h, level: min < 24 && !inlineLink(el) ? "error" : "warn", inline: inlineLink(el) })
  }

  // Text under 12px.
  const tiny = []
  for (const el of scope.querySelectorAll("*")) {
    if (!visible(el) || !hasOwnText(el)) continue
    const size = parseFloat(getComputedStyle(el).fontSize)
    if (size < 12) tiny.push(`${desc(el)} ${size}px`)
  }

  // Images drawn at a different aspect ratio than their own.
  const distorted = []
  for (const im of scope.querySelectorAll("img")) {
    if (!visible(im) || !im.naturalWidth) continue
    if (["cover", "contain", "scale-down"].includes(getComputedStyle(im).objectFit)) continue
    // The picture fills the content box; padding and border are around it.
    const r = im.getBoundingClientRect()
    const cs = getComputedStyle(im)
    const px = (...props) => props.reduce((sum, p) => sum + (parseFloat(cs[p]) || 0), 0)
    const w = r.width - px("paddingLeft", "paddingRight", "borderLeftWidth", "borderRightWidth")
    const h = r.height - px("paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth")
    if (w <= 0 || h <= 0) continue
    const drawn = w / h, own = im.naturalWidth / im.naturalHeight
    if (Math.abs(drawn / own - 1) > 0.05)
      distorted.push(`${desc(im)} drawn ${Math.round(w)}×${Math.round(h)} (ratio ${drawn.toFixed(2)}, image ${own.toFixed(2)})`)
  }

  // A sheet or dialog whose content doesn't fit and has to be scrolled.
  const clippedBody = []
  if (layer) {
    const body = layer.querySelector(".offcanvas-body, .modal-body")
    if (body && body.scrollHeight > body.clientHeight + 1)
      clippedBody.push(`${Math.round(body.scrollHeight - body.clientHeight)}px of the ${layer.classList.contains("modal") ? "dialog" : "sheet"} is scrolled out of view (${body.clientHeight}px shown of ${body.scrollHeight}px)`)
  }

  // An id used more than once: a <label for> or aria-* reference reaches only
  // the first element with it.
  const seen = {}
  for (const el of document.querySelectorAll("[id]")) seen[el.id] = (seen[el.id] || 0) + 1
  const dupIds = Object.entries(seen).filter(([, n]) => n > 1).map(([id, n]) => `id "${id}" is used ${n} times`)

  // Page structure: one main region and one h1 (visually hidden ones count).
  const structure = []
  const mains = document.querySelectorAll("main, [role=main]").length
  const h1s = document.querySelectorAll("h1").length
  if (mains !== 1) structure.push(`${mains} main regions (want 1)`)
  if (h1s !== 1) structure.push(`${h1s} h1 headings (want 1)`)

  return {
    vw, vh, docW: document.documentElement.scrollWidth, layer: !!layer, clippedBody, dupIds, structure,
    spills: spills.slice(0, 6).map((x) => x.text),
    overflow: over.slice(0, 6).map(({ el, r }) => `${desc(el)} spans ${Math.round(r.left)}..${Math.round(r.right)}px of ${vw}`),
    targets, tiny, distorted,
  }
}

// Content hidden under a fixed bar. Called at the top of the page (header) and
// scrolled to the end (bottom bar).
function covered(where) {
  const vh = innerHeight
  const fixed = [...document.querySelectorAll("body *")].filter((el) => {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    // Fixed bars, and sticky ones (the cart's checkout bar on phones).
    return (cs.position === "fixed" || cs.position === "sticky") && r.width > 0 && r.height > 0 && r.height < vh * 0.5 && !el.closest(".offcanvas, .modal")
  })
  const inFixed = (el) => fixed.some((f) => f.contains(el))
  const content = [...document.querySelectorAll("body *")].filter((el) => {
    if (inFixed(el)) return false
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") return false
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
    return ownText || ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)
  })
  const label = (el) => (el.getAttribute("aria-label") || el.textContent.trim() || `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`).trim().replace(/\s+/g, " ").slice(0, 40)
  if (where === "top") {
    const bar = fixed.map((el) => el.getBoundingClientRect()).filter((r) => r.top <= 1 && r.bottom < vh / 2)
    const barBottom = Math.max(0, ...bar.map((r) => r.bottom))
    if (!barBottom) return null
    const hit = content.find((el) => { const r = el.getBoundingClientRect(); return r.top < barBottom - 1 && r.bottom > 0 })
    return hit ? `"${label(hit)}" starts at ${Math.round(hit.getBoundingClientRect().top)}px, under the ${Math.round(barBottom)}px header` : null
  }
  const bar = fixed.map((el) => el.getBoundingClientRect()).filter((r) => r.bottom >= vh - 1 && r.top > vh / 2)
  if (!bar.length) return null
  const barTop = Math.min(...bar.map((r) => r.top))
  let last = null, lastBottom = 0
  for (const el of content) {
    const b = el.getBoundingClientRect().bottom
    if (b > lastBottom) { lastBottom = b; last = el }
  }
  return lastBottom > barTop + 1 ? `"${label(last)}" ends at ${Math.round(lastBottom)}px, under the bottom bar at ${Math.round(barTop)}px` : null
}

// Where keyboard focus lands. Called after each Tab: the focused control, if
// a fixed bar (one it isn't part of) hides more of it than it must. Something
// taller than the space between the bars can't be fully shown, so it only has
// to fill that space.
function focusUnderBar() {
  const el = document.activeElement
  if (!el || el === document.body) return null
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return null
  // A fixed control (the skip link, shown over the header when focused) never
  // scrolls: whether a bar covers it depends on which is drawn on top, not on
  // position, so this check leaves it out.
  if (getComputedStyle(el).position === "fixed") return null
  let top = 0, bottom = innerHeight
  for (const bar of document.querySelectorAll("body *")) {
    const pos = getComputedStyle(bar).position
    if ((pos !== "fixed" && pos !== "sticky") || bar.contains(el) || bar.closest(".offcanvas, .modal")) continue
    const b = bar.getBoundingClientRect()
    if (!b.width || !b.height || b.height > innerHeight * 0.5) continue
    if (b.top <= 1) top = Math.max(top, b.bottom)
    else if (b.bottom >= innerHeight - 1) bottom = Math.min(bottom, b.top)
  }
  const shown = Math.min(r.bottom, bottom) - Math.max(r.top, top)
  if (shown >= Math.min(r.height, bottom - top) - 1) return null
  const name = (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40)
  return `"${name}" is ${Math.round(r.height - Math.max(0, shown))}px under a fixed bar when focused (visible band ${Math.round(top)}..${Math.round(bottom)}px)`
}

// ---------------------------------------------------------------- runner
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once("error", reject)
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)) })
  })

// The app must call the mock on /api whatever the local .env says, and PayPal
// runs in sandbox mode. Variables already in the environment beat .env files.
// Stripe's key is .env's (or the environment's): only whether there is one
// is read here.
process.env.VITE_BE_URL = "/api"
process.env.VITE_PAYPAL_CLIENT_ID = "sb"
const CARDS_ON = !!(process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? loadEnv("development", ROOT, "VITE_").VITE_STRIPE_PUBLISHABLE_KEY)

const port = await freePort()
const server = await createServer({
  root: ROOT,
  logLevel: "warn",
  server: { port, strictPort: true, host: "127.0.0.1" },
})
await server.listen()
const BASE = `http://127.0.0.1:${port}`

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }
)

const placeholder = (url) => {
  const [, w, h, hue] = url.match(/\/(\d+)x(\d+)\/(\d+)/) || [, 800, 600, 200]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="hsl(${hue} 45% 62%)"/><circle cx="50%" cy="50%" r="${Math.min(w, h) / 4}" fill="hsl(${hue} 45% 78%)"/></svg>`
}

const mockApi = async (route, role) => {
  if (DELAY) await new Promise((r) => setTimeout(r, DELAY))
  const p = new URL(route.request().url()).pathname.replace(/^\/api/, "")
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
  const [s1, s2] = fixtures.shops
  if (p === "/users/me") return role ? json(fixtures.users[role]) : json({ message: "Unauthorized" }, 401)
  if (p === "/auth/refreshToken") return json({ message: "No refresh token" }, 401)
  if (p === "/auth/sessions") return json(fixtures.sessions)
  if (p === "/shops/s1") return json(s1)
  if (p === "/shops/s2") return json(s2)
  if (p === "/shops/s1/tables/status") return json(fixtures.tableStatus)
  if (/^\/shops\/s1\/tables\/[^/]+\/carts$/.test(p)) return json(fixtures.tableCarts)
  // The manager's own shops carry the tables they deleted; one deleted an hour
  // ago (dated at run time), with a recent cart, is listed, so its section is
  // checked too.
  if (p === "/shops/me") {
    const deletedAt = new Date(Date.now() - 3600_000).toISOString()
    return json([{ ...s1, deletedTables: [{ _id: "t-gone", name: "Garden terrace by the fountain", deletedAt, recentCartsUntil: new Date(Date.now() + 20 * 3600_000).toISOString() }] }, s2])
  }
  // The home page's first page, with a next one (empty), so "Show more" is checked too.
  if (p === "/shops/browse") {
    if (new URL(route.request().url()).searchParams.get("cursor")) return json({ shops: [], next: null })
    return json({ shops: fixtures.shops.map(({ _id, name, bio, cover }) => ({ _id, name, bio, cover })), next: s2._id })
  }
  if (p.startsWith("/shops")) return json(fixtures.shops)
  if (p === "/carts/tables/t1") return json(fixtures.cart)
  return json({ message: "Not mocked" }, 404)
}

const settle = async (page) => {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}

const run = async ([id, role, url, action], vp) => {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    // Instant scrolling, so a focused control is checked where it ends up
    // rather than mid smooth-scroll (Bootstrap turns smooth scrolling on).
    reducedMotion: "reduce",
  })
  const page = await ctx.newPage()
  const r = { screen: id, viewport: vp.name, errors: [], warnings: [], shots: [] }
  page.on("pageerror", (e) => r.warnings.push({ kind: "page error", text: e.message.split("\n")[0].slice(0, 140) }))
  await page.route("**/api/**", (route) => mockApi(route, role))
  await page.route("https://img.fixtures.test/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: placeholder(route.request().url()) })
  )
  // Layout shift (CLS): how much visible content jumps as the page loads.
  await page.addInitScript(() => {
    window.__cls = 0
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value
    }).observe({ type: "layout-shift", buffered: true })
  })
  if (vp.text) {
    await page.addInitScript((scale) => {
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style")
        s.textContent = `html { font-size: ${scale * 100}% !important; }`
        document.head.append(s)
      })
    }, vp.text)
  }
  const shot = async (suffix, fullPage) => {
    const file = `${id}-${vp.name}${suffix}.png`
    await page.screenshot({ path: path.join(OUT, file), fullPage })
    r.shots.push(file)
  }
  try {
    if (DELAY && !action) {
      // Part-way through the held-back answers: the page's loading state.
      await page.goto(BASE + url, { waitUntil: "load", timeout: 30000 })
      await page.waitForTimeout(DELAY / 2)
      await shot("-loading", false)
    }
    await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 })
    await settle(page)
    // Layout shift is read here, once the page has loaded: before any action
    // (opening a sheet or dialog is a change the viewer asked for) and before
    // the checks below scroll the page.
    const cls = await page.evaluate(() => window.__cls)
    if (cls > 0.1) r.errors.push({ kind: "layout shift", text: `CLS ${cls.toFixed(3)} while loading (over 0.1)` })
    if (action) {
      // An action is one control to click, or several in turn (a dialog
      // opened from inside another); a function step does something else.
      const open = async () => {
        for (const step of [ACTIONS[action](page)].flat()) {
          await (typeof step === "function" ? step() : step.click({ timeout: 5000 }))
          await page.waitForTimeout(900)
        }
      }
      await open()
      if (action === "checkout") {
        // PayPal's buttons come from its SDK over the network, in iframes, and the
        // sandbox SDK sometimes fails to render in headless Chrome: reload once.
        // PayPal's own iframes (Stripe's form is in one too).
        const paypal = () => page.waitForFunction(() => [...document.querySelectorAll(".offcanvas.show .paypal-buttons iframe")]
          .some((f) => f.getBoundingClientRect().height > 0), null, { timeout: 15000 }).then(() => true, () => false)
        let loaded = await paypal()
        if (!loaded) {
          await page.reload({ waitUntil: "networkidle" })
          await settle(page)
          await open()
          loaded = await paypal()
        }
        if (loaded) await page.waitForTimeout(1500)
        else r.warnings.push({ kind: "not loaded", text: "PayPal buttons didn't load (offline?)" })
        // With a Stripe key the sheet shows its card form under PayPal's
        // button, in its own iframe: waited for too.
        if (CARDS_ON) {
          const card = await page.getByRole("button", { name: /^Pay £/ }).waitFor({ timeout: 20000 })
            .then(async () => {
              await page.waitForFunction(() => !document.querySelector(".offcanvas.show button[type=submit]")?.disabled, null, { timeout: 20000 })
              return true
            }, () => false)
          if (card) await page.waitForTimeout(1500)
          else r.warnings.push({ kind: "not loaded", text: "Stripe's card form didn't load (offline?)" })
        }
      }
      await settle(page)
    }
    const a = await page.evaluate(audit)
    if (a.docW > a.vw + 1 || a.overflow.length)
      r.errors.push({ kind: "overflow", text: a.overflow.length ? a.overflow.join("; ") : `page is ${a.docW}px wide on a ${a.vw}px screen` })
    for (const t of a.spills) r.errors.push({ kind: "spill", text: t })
    for (const t of a.dupIds) r.errors.push({ kind: "duplicate id", text: t })
    for (const t of a.structure) r.errors.push({ kind: "structure", text: t })
    for (const t of a.targets)
      (t.level === "error" ? r.errors : r.warnings).push({
        kind: "target",
        text: `${t.d} is ${t.w}×${t.h}px${t.level === "warn" ? (t.inline && Math.min(t.w, t.h) < 24 ? " (inline link, exempt from 24px)" : " (under 44×32)") : ""}`,
      })
    for (const t of a.tiny) r.warnings.push({ kind: "tiny text", text: t })
    for (const c of a.clippedBody) r.warnings.push({ kind: "scrolls", text: c })
    for (const d of a.distorted) r.warnings.push({ kind: "stretched image", text: d })
    if (!action) {
      const top = await page.evaluate(covered, "top")
      if (top) r.errors.push({ kind: "covered", text: top })
    }
    // Tab through the page (at most 40 stops) and report controls that land
    // under a fixed bar. Screens with an open sheet or dialog trap focus in
    // it, so only plain pages are walked.
    if (!action) {
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab")
        const hit = await page.evaluate(focusUnderBar)
        if (hit) { r.errors.push({ kind: "focus hidden", text: hit }); break }
      }
      await page.evaluate(() => { document.activeElement?.blur(); scrollTo(0, 0) })
      await page.waitForTimeout(100)
    }
    const landscape = vp.width > vp.height && vp.mobile
    await shot("", !action && !landscape)
    if (!action) {
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
      await page.waitForTimeout(250)
      const bottom = await page.evaluate(covered, "bottom")
      if (bottom) r.errors.push({ kind: "covered", text: bottom })
      if (landscape) await shot("-end", false)
    }
  } catch (e) {
    r.errors.push({ kind: "failed", text: e.message.split("\n")[0].slice(0, 200) })
  }
  await ctx.close()
  return r
}

// Group identical findings (six −/+ buttons at the same size are one line).
const group = (list) => {
  const m = new Map()
  for (const x of list) {
    const k = `${x.kind}|${x.text}`
    m.set(k, { ...x, n: (m.get(k)?.n ?? 0) + 1 })
  }
  return [...m.values()]
}

fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })

// Warm up: the first request makes Vite optimise dependencies.
{
  const p = await browser.newPage()
  await p.route("**/api/**", (route) => mockApi(route, null))
  await p.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {})
  await p.close()
}

const jobs = viewports.flatMap((vp) => screens.map((s) => [s, vp]))
const results = []
let next = 0
const worker = async () => {
  while (next < jobs.length) {
    const [s, vp] = jobs[next++]
    const r = await run(s, vp)
    results.push(r)
    process.stdout.write(`${r.errors.length ? "✗" : "✓"} ${r.screen} @ ${r.viewport}${r.errors.length ? ` (${group(r.errors).length} errors)` : ""}\n`)
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
await browser.close()
await server.close()

// ---------------------------------------------------------------- report
const order = (r) => screens.findIndex((s) => s[0] === r.screen) * 100 + viewports.findIndex((v) => v.name === r.viewport)
results.sort((a, b) => order(a) - order(b))
const cell = (r) => {
  if (!r) return ""
  const e = group(r.errors).length, w = group(r.warnings).length
  return e ? `✗ ${e}${w ? ` · ⚠ ${w}` : ""}` : w ? `⚠ ${w}` : "✓"
}
const find = (s, v) => results.find((r) => r.screen === s[0] && r.viewport === v.name)
const lines = [
  "# Responsive audit",
  "",
  `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${screens.length} screens × ${viewports.length} viewports`,
  "",
  "✗ errors (overflow, spill out of a card/sheet/dialog, control under 24px, content or a focused control under a fixed bar, duplicate id, not exactly one main and one h1, layout shift over 0.1) · ⚠ warnings (control under 44×32: both sides under 44px or one under 32px, inline link under 24px, text under 12px, stretched image, sheet or dialog content scrolled out of view, page error). Counts are distinct findings.",
  "",
  `| Screen | ${viewports.map((v) => v.name).join(" | ")} |`,
  `|---|${viewports.map(() => "---").join("|")}|`,
  ...screens.map((s) => `| ${s[0]} | ${viewports.map((v) => cell(find(s, v))).join(" | ")} |`),
  "",
]
for (const r of results) {
  if (!r.errors.length && !r.warnings.length) continue
  lines.push(`## ${r.screen} @ ${r.viewport}`, "")
  for (const x of group(r.errors)) lines.push(`- ✗ **${x.kind}**: ${x.text}${x.n > 1 ? ` (×${x.n})` : ""}`)
  for (const x of group(r.warnings)) lines.push(`- ⚠ ${x.kind}: ${x.text}${x.n > 1 ? ` (×${x.n})` : ""}`)
  lines.push("", r.shots.map((f) => `[${f}](${f})`).join(" · "), "")
}
fs.writeFileSync(path.join(OUT, "report.md"), lines.join("\n"))
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 1))

const failed = results.filter((r) => r.errors.length)
console.log(`\n${results.length} checked, ${failed.length} with errors. Report: ${path.relative(process.cwd(), path.join(OUT, "report.md"))}`)
process.exit(failed.length ? 1 : 0)
