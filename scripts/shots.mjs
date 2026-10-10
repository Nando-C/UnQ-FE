// Screenshots of the live demo for the README and docs/: each screen is
// driven in headless Chrome against the deployed site and its demo data (see
// UnQ-BE's `npm run seed:demo`), then framed in a phone or a browser window
// drawn here, at 2x.
//
//   npm run shots -- --env=../UnQ-BE/.env [--base=https://un-q.vercel.app] [--shots=menu,tables] [--out=docs/images]
//
// `--env` names a file holding DEMO_MANAGER_PASSWORD and DEMO_DINER_PASSWORD
// (the demo's two sign-ins; only those two lines are read, nothing is printed).
// Needs Google Chrome installed (CHROME_PATH for another Chromium).
//
// The run changes the demo: it pays for two items at Garden 1 by test card and
// releases a selection at Marlow's Table 3, so the shots show real outcomes.
// Seeding again restores the demo.
import fs from "node:fs"
import path from "node:path"
import { chromium } from "playwright-core"

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}
const BASE = arg("base", "https://un-q.vercel.app").replace(/\/$/, "")
const OUT = path.resolve(arg("out", "docs/images"))
const ONLY = arg("shots", "").split(",").filter(Boolean)
const ENV_FILE = arg("env", "")
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

const DEMO_SHOP = "6158a19282eaef10787cd6f3"
const MANAGER = "manager@mail.com"
const DINER = "frank@mail.com"

// The two passwords, read from the named file (and the environment first).
const secrets = () => {
  const out = { manager: process.env.DEMO_MANAGER_PASSWORD, diner: process.env.DEMO_DINER_PASSWORD }
  if (ENV_FILE && (!out.manager || !out.diner)) {
    for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
      const m = line.match(/^\s*(DEMO_MANAGER_PASSWORD|DEMO_DINER_PASSWORD)\s*=\s*(.*?)\s*$/)
      if (!m) continue
      const value = m[2].replace(/^["']|["']$/g, "")
      if (m[1] === "DEMO_MANAGER_PASSWORD") out.manager ||= value
      else out.diner ||= value
    }
  }
  if (!out.manager || !out.diner) {
    console.error("Set DEMO_MANAGER_PASSWORD and DEMO_DINER_PASSWORD, or pass --env=<file> holding them")
    process.exit(2)
  }
  return out
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fail = (msg) => { console.error(msg); process.exit(1) }

// ---------------------------------------------------------------- the frames

// A phone around a 390×844 capture: a dark body with rounded corners, side
// keys, a status bar above the screen and the island over it.
const phoneFrame = (png) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}
  .stage{display:inline-block;padding:28px 34px 40px}
  .phone{position:relative;width:390px;border:12px solid #1c1c1e;border-radius:60px;background:#1c1c1e;
    box-shadow:0 30px 60px rgba(0,0,0,.28),0 2px 6px rgba(0,0,0,.25),inset 0 0 0 2px #3a3a3c}
  .screen{border-radius:48px;overflow:hidden;background:#fff}
  .status{height:50px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 30px 8px;
    font:600 15px/1 -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif;color:#111}
  .status .icons{display:flex;gap:6px;align-items:center}
  .island{position:absolute;left:50%;top:11px;transform:translateX(-50%);width:120px;height:35px;border-radius:20px;background:#000}
  .key{position:absolute;background:#2c2c2e;border-radius:2px}
  .key.mute{left:-16px;top:150px;width:4px;height:34px}
  .key.vol1{left:-16px;top:210px;width:4px;height:62px}
  .key.vol2{left:-16px;top:290px;width:4px;height:62px}
  .key.power{right:-16px;top:230px;width:4px;height:96px}
  img{display:block;width:390px}
</style><div class="stage"><div class="phone">
  <div class="key mute"></div><div class="key vol1"></div><div class="key vol2"></div><div class="key power"></div>
  <div class="screen"><div class="status"><span>9:41</span><span class="icons">
    <svg width="18" height="12" viewBox="0 0 18 12" fill="#111"><rect x="0" y="8" width="3" height="4" rx=".6"/><rect x="5" y="5.5" width="3" height="6.5" rx=".6"/><rect x="10" y="3" width="3" height="9" rx=".6"/><rect x="15" y="0" width="3" height="12" rx=".6"/></svg>
    <svg width="17" height="12" viewBox="0 0 17 12" fill="#111"><path d="M8.5 9.6a1.7 1.7 0 1 1 0 2.4 1.7 1.7 0 0 1 0-2.4zM4.9 6.5a5.1 5.1 0 0 1 7.2 0l-1.2 1.2a3.4 3.4 0 0 0-4.8 0zM1.3 3a10.2 10.2 0 0 1 14.4 0l-1.2 1.2a8.5 8.5 0 0 0-12 0z"/></svg>
    <svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="22" height="12" rx="3.5" fill="none" stroke="#111" stroke-opacity=".4"/><rect x="2" y="2" width="19" height="9" rx="2" fill="#111"/><path d="M24.5 4.5v4a2 2 0 0 0 0-4z" fill="#111" fill-opacity=".4"/></svg>
  </span></div><img src="${png}"></div>
  <div class="island"></div>
</div></div>`

// A browser window around a desktop capture: title bar with the three lights
// and the address, then the page.
const browserFrame = (png, width, url) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;background:transparent}
  .stage{display:inline-block;padding:28px 40px 48px}
  .win{width:${width}px;border-radius:12px;overflow:hidden;background:#fff;
    box-shadow:0 24px 56px rgba(0,0,0,.26),0 1px 3px rgba(0,0,0,.3)}
  .bar{height:46px;background:linear-gradient(#ececec,#dcdcdc);border-bottom:1px solid #b9b9b9;display:flex;align-items:center;padding:0 16px;gap:8px;
    font:13px/1 -apple-system,"SF Pro Text","Helvetica Neue",Arial,sans-serif;color:#333}
  .lights{display:flex;gap:8px;margin-right:14px}
  .lights i{width:12px;height:12px;border-radius:50%;display:block;border:1px solid rgba(0,0,0,.15)}
  .nav{display:flex;gap:10px;color:#8e8e93;font-size:16px;margin-right:6px}
  .url{flex:1;max-width:720px;margin:0 auto;height:28px;border-radius:7px;background:#fff;border:1px solid #cfcfcf;display:flex;align-items:center;justify-content:center;gap:7px;color:#222}
  .url svg{flex:none}
  img{display:block;width:${width}px}
</style><div class="stage"><div class="win">
  <div class="bar"><span class="lights"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></span>
    <span class="nav">‹ ›</span>
    <span class="url"><svg width="10" height="12" viewBox="0 0 10 12" fill="#555"><rect x="0" y="5" width="10" height="7" rx="1.5"/><path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5h-1.3V3.5a1.2 1.2 0 0 0-2.4 0V5z"/></svg>${url}</span>
    <span style="width:120px"></span></div>
  <img src="${png}"></div></div>`

const frame = async (browser, html, outFile) => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })
  await page.setContent(html)
  await page.waitForLoadState("load")
  await sleep(100)
  const el = page.locator(".stage")
  await el.screenshot({ path: outFile, omitBackground: true })
  await page.close()
}

const dataUrl = (buffer) => `data:image/png;base64,${buffer.toString("base64")}`

// ---------------------------------------------------------------- the browser

const signIn = async (page, email, password) => {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" })
  await page.locator("#login-email").fill(email)
  await page.locator("#login-password").fill(password)
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/auth/login") && r.status() === 200, { timeout: 60000 }),
    page.getByRole("button", { name: "Log in", exact: true }).click(),
  ])
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 })
  await page.waitForLoadState("networkidle")
}

// Every <img> on the page decoded, so a capture never shows a half-loaded photo.
const imagesSettled = (page) => page.evaluate(() => Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r }))))

const goto = async (page, url, settle = 800) => {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 60000 })
  await imagesSettled(page)
  await sleep(settle)
}

const closeSheet = async (page) => {
  const close = page.locator(".offcanvas.show button.btn-close, .modal.show button.btn-close").first()
  if (await close.count()) await close.click()
  await page.waitForFunction(() => !document.querySelector(".offcanvas.show, .modal.show"), null, { timeout: 10000 }).catch(() => {})
  await sleep(400)
}

const shop = async (id) => {
  const res = await fetch(`${BASE}/api/shops/${id}`)
  if (!res.ok) fail(`Shop ${id}: ${res.status}`)
  return res.json()
}
const tableOf = (s, name) => {
  const t = s.tables.find((t) => t.name === name)
  if (!t) fail(`No table "${name}" at ${s.name}: seed the demo first`)
  return t._id
}

// ---------------------------------------------------------------- the shots

const { manager: managerPassword, diner: dinerPassword } = secrets()
fs.mkdirSync(OUT, { recursive: true })

const health = await fetch(`${BASE}/api/health`).catch(() => null)
if (!health?.ok) fail(`${BASE}/api/health didn't answer: is the API awake?`)

const rocketlit = await shop(DEMO_SHOP)
const browse = await (await fetch(`${BASE}/api/shops/browse`)).json()
const marlowId = (browse.shops ?? browse).find((s) => s.name === "Marlow Street Kitchen")?._id
if (!marlowId) fail("Marlow Street Kitchen isn't on the live site: seed the demo first")
const marlow = await shop(marlowId)
const T = {
  fire: tableOf(rocketlit, "Fire Place 🔥"),
  window: tableOf(rocketlit, "Window"),
  garden1: tableOf(rocketlit, "Garden 1"),
  garden2: tableOf(rocketlit, "Garden 2"),
  marlow3: tableOf(marlow, "Table 3"),
}

const browser = await chromium.launch({ executablePath: CHROME })
const phone = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
})
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const p = await phone.newPage()
const d = await desktop.newPage()

const taken = []
const save = async (id, kind, page, url, options = {}) => {
  const png = await page.screenshot({ type: "png", ...options })
  const out = path.join(OUT, `${id}.png`)
  const html = kind === "phone" ? phoneFrame(dataUrl(png)) : browserFrame(dataUrl(png), options.fullPage ? 1440 : 1440, url)
  await frame(browser, html, out)
  taken.push(id)
  console.log(`✓ ${id}`)
}
const wanted = (id) => ONLY.length === 0 || ONLY.includes(id)

// Manager first: the release at Marlow gives the diner a notice to show later.
await signIn(d, MANAGER, managerPassword)
if (wanted("my-shops")) {
  await goto(d, "/")
  await save("my-shops", "browser", d, "un-q.vercel.app")
}
if (wanted("tables") || wanted("table-sheet") || wanted("refund") || wanted("item-editor") || wanted("qr-print")) {
  await goto(d, `/shop/${DEMO_SHOP}`, 1500)
  await d.locator("#tableList").scrollIntoViewIfNeeded()
  await d.evaluate(() => document.getElementById("tableList").scrollIntoView({ block: "start" }))
  await sleep(1200)
  if (wanted("tables")) await save("tables", "browser", d, `un-q.vercel.app/shop/${DEMO_SHOP}`)
  if (wanted("table-sheet") || wanted("refund")) {
    await d.getByRole("button", { name: "View table Window" }).click()
    await d.locator(".modal.show").waitFor()
    await d.waitForLoadState("networkidle")
    await sleep(1000)
    if (wanted("table-sheet")) await save("table-sheet", "browser", d, `un-q.vercel.app/shop/${DEMO_SHOP}`)
    if (wanted("refund")) {
      await d.getByRole("button", { name: /^Refund items from Ben's payment/ }).click()
      await d.getByRole("button", { name: "Refund one more Latte" }).click()
      await d.getByRole("combobox", { name: "Reason" }).selectOption("wrong_item")
      await d.getByRole("button", { name: "Review refund" }).click()
      await sleep(600)
      await save("refund", "browser", d, `un-q.vercel.app/shop/${DEMO_SHOP}`)
    }
    await closeSheet(d)
  }
  if (wanted("pay-back")) {
    await d.getByRole("button", { name: "View table Garden 2" }).click()
    await d.locator(".modal.show").waitFor()
    await d.waitForLoadState("networkidle")
    await sleep(800)
    await d.getByRole("button", { name: "Mark paid back" }).click()
    await sleep(600)
    await save("pay-back", "browser", d, `un-q.vercel.app/shop/${DEMO_SHOP}`)
    await closeSheet(d)
  }
  if (wanted("item-editor")) {
    await d.getByRole("button", { name: "Edit Avocado Toast" }).click()
    await d.locator(".modal.show").waitFor()
    await sleep(800)
    await save("item-editor", "browser", d, `un-q.vercel.app/shop/${DEMO_SHOP}`)
    await closeSheet(d)
  }
  if (wanted("qr-print")) {
    await d.emulateMedia({ media: "print" })
    await sleep(800)
    // Only the tables print; the capture is clipped to them.
    await d.evaluate(() => window.scrollTo(0, 0))
    await sleep(300)
    const box = await d.locator("#tableList").boundingBox()
    await save("qr-print", "browser", d, `un-q.vercel.app/shop/${DEMO_SHOP}`, { fullPage: true, clip: { x: 0, y: 0, width: 1440, height: Math.ceil(box.y + box.height + 40) } })
    await d.emulateMedia({ media: "screen" })
  }
}
if (wanted("notice")) {
  // Release Frank's selection at Marlow's Table 3, so he has a notice to see.
  await goto(d, `/shop/${marlowId}`, 1200)
  await d.getByRole("button", { name: "View table Table 3" }).click()
  await d.locator(".modal.show").waitFor()
  await d.waitForLoadState("networkidle")
  const release = d.getByRole("button", { name: /^Release Frank's selection/ }).first()
  await release.waitFor({ timeout: 15000 }).catch(() => {})
  if (await release.count()) {
    await release.click()
    await d.locator(".modal.show").getByRole("button", { name: "Release", exact: true }).click()
    await sleep(1500)
  }
  await closeSheet(d)
}
if (wanted("api-docs")) {
  await goto(d, "/api/docs", 1500)
  await save("api-docs", "browser", d, "un-q.vercel.app/api/docs")
}

// Then the diner, on the phone.
if (wanted("home")) {
  await goto(p, "/", 1200)
  await save("home", "phone", p)
}
if (wanted("menu")) {
  await goto(p, `/shops/${DEMO_SHOP}/tables/${T.fire}`, 1500)
  await save("menu", "phone", p)
}
await signIn(p, DINER, dinerPassword)
if (wanted("cart") || wanted("checkout") || wanted("paid")) {
  await goto(p, `/shops/${DEMO_SHOP}/tables/${T.garden1}/cart`, 1200)
  // The checkbox sits under its 44px tap label, which takes the pointer.
  await p.getByRole("checkbox", { name: "Select Shakshuka to pay" }).click({ force: true })
  await sleep(600)
  await p.getByRole("checkbox", { name: "Select Fresh Orange Juice to pay" }).click({ force: true })
  await p.waitForLoadState("networkidle")
  await sleep(1200)
  if (wanted("cart")) await save("cart", "phone", p)
  if (wanted("checkout") || wanted("paid")) {
    await p.getByRole("button", { name: /^Check out/ }).click()
    await p.locator(".offcanvas.show").waitFor()
    await p.waitForFunction(() => {
      const pay = [...document.querySelectorAll(".offcanvas.show button[type=submit]")].find((b) => /^Pay/.test(b.textContent))
      return pay && !pay.disabled
    }, null, { timeout: 60000 })
    await sleep(2500)
    if (wanted("checkout")) await save("checkout", "phone", p)
    if (wanted("paid")) {
      const card = p.frameLocator('iframe[title="Secure payment input frame"]').first()
      await card.locator('input[name="number"]').fill("4242 4242 4242 4242")
      await card.locator('input[name="expiry"]').fill("12 / 34")
      await card.locator('input[name="cvc"]').fill("123")
      const postal = card.locator('input[name="postalCode"]')
      if (await postal.count()) await postal.fill("SW1A 1AA")
      await p.locator(".offcanvas.show button[type=submit]").click()
      await p.getByText("Payment successful").waitFor({ timeout: 90000 })
      await sleep(800)
      await save("paid", "phone", p)
    }
  }
}
if (wanted("notice")) {
  await goto(p, `/shops/${marlowId}/tables/${T.marlow3}/cart`, 1200)
  await save("notice", "phone", p)
}

await browser.close()
console.log(`${taken.length} shots in ${path.relative(process.cwd(), OUT)}`)
