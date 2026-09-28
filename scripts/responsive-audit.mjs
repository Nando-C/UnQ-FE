// Responsive audit: renders every main screen at phone, tablet and desktop sizes
// (plus a phone with text at 200%) in headless Chrome against a mocked API, and
// reports layout problems that jsdom can't see.
//
//   npm run audit:responsive
//   npm run audit:responsive -- --screens=c-menu,c-cart --viewports=320,390-text200
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

import { chromium } from "playwright-core"
import { createServer } from "vite"
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
  checkout: (p) => p.getByRole("button", { name: /checkout/i }).first(),
  // Icon-only, with no accessible name yet (S28), so found by its icon.
  editAccount: (p) => p.locator("button:has(svg)").first(),
  editShop: (p) => p.getByRole("button", { name: /edit details/i }).first(),
  addItem: (p) => p.getByRole("button", { name: /add menu item/i }).first(),
  addTable: (p) => p.getByRole("button", { name: /add table/i }).first(),
  viewTable: (p) => p.getByRole("button", { name: /view table/i }).first(),
  refundPicker: (p) => [
    p.getByRole("button", { name: /view table/i }).first(),
    p.getByRole("button", { name: /^refund items from/i }).first(),
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
  for (const el of scope.querySelectorAll(sel)) {
    if (!visible(el) || el.closest("[aria-hidden=true]")) continue
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

  return {
    vw, vh, docW: document.documentElement.scrollWidth, layer: !!layer, clippedBody,
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
    return cs.position === "fixed" && r.width > 0 && r.height > 0 && r.height < vh * 0.5 && !el.closest(".offcanvas, .modal")
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

// ---------------------------------------------------------------- runner
const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once("error", reject)
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)) })
  })

// The app must call the mock on /api whatever the local .env says, and PayPal
// runs in sandbox mode. Variables already in the environment beat .env files.
process.env.VITE_BE_URL = "/api"
process.env.VITE_PAYPAL_CLIENT_ID = "sb"

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

const mockApi = (route, role) => {
  const p = new URL(route.request().url()).pathname.replace(/^\/api/, "")
  const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
  const [s1, s2] = fixtures.shops
  if (p === "/users/me") return role ? json(fixtures.users[role]) : json({ message: "Unauthorized" }, 401)
  if (p === "/auth/refreshToken") return json({ message: "No refresh token" }, 401)
  if (p === "/shops/s1") return json(s1)
  if (p === "/shops/s2") return json(s2)
  if (p === "/shops/s1/tables/status") return json(fixtures.tableStatus)
  if (/^\/shops\/s1\/tables\/[^/]+\/carts$/.test(p)) return json(fixtures.tableCarts)
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
  })
  const page = await ctx.newPage()
  const r = { screen: id, viewport: vp.name, errors: [], warnings: [], shots: [] }
  page.on("pageerror", (e) => r.warnings.push({ kind: "page error", text: e.message.split("\n")[0].slice(0, 140) }))
  await page.route("**/api/**", (route) => mockApi(route, role))
  await page.route("https://img.fixtures.test/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: placeholder(route.request().url()) })
  )
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
    await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 30000 })
    await settle(page)
    if (action) {
      // An action is one control to click, or several in turn (a dialog
      // opened from inside another).
      const open = async () => {
        for (const step of [ACTIONS[action](page)].flat()) {
          await step.click({ timeout: 5000 })
          await page.waitForTimeout(900)
        }
      }
      await open()
      // PayPal's buttons come from its SDK over the network, in iframes, and the
      // sandbox SDK sometimes fails to render in headless Chrome: reload once.
      if (action === "checkout") {
        const paypal = () => page.waitForFunction(() => [...document.querySelectorAll(".offcanvas.show iframe")]
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
      }
      await settle(page)
    }
    const a = await page.evaluate(audit)
    if (a.docW > a.vw + 1 || a.overflow.length)
      r.errors.push({ kind: "overflow", text: a.overflow.length ? a.overflow.join("; ") : `page is ${a.docW}px wide on a ${a.vw}px screen` })
    for (const t of a.spills) r.errors.push({ kind: "spill", text: t })
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
  "✗ errors (overflow, spill out of a card/sheet/dialog, control under 24px, content under a fixed bar) · ⚠ warnings (control under 44×32: both sides under 44px or one under 32px, inline link under 24px, text under 12px, stretched image, sheet or dialog content scrolled out of view, page error). Counts are distinct findings.",
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
