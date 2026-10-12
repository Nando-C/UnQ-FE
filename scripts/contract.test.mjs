// The API contract this client depends on is UnQ-BE's OpenAPI document, kept
// here as a fixture (openapi.json, refreshed from the API about to ship with
// `npm run contract:refresh`). Every URL the client calls must be an operation
// in it, so a route the API renames or drops fails here, not at a table.
// Outside src, as plain JS, so Node's types stay out of the app's type check.
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const ROOT = path.join(import.meta.dirname, "..")
const SRC = path.join(ROOT, "src")
const spec = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "openapi.json"), "utf8"))
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"))

// Every call the client makes, as the document names it. A new call site is
// added here (the sweep below insists) and must exist in the document.
const CLIENT_CALLS = [
  ["POST", "/auth/register"],
  ["POST", "/auth/login"],
  ["POST", "/auth/refreshToken"],
  ["GET", "/auth/logout"],
  ["GET", "/auth/sessions"],
  ["DELETE", "/auth/sessions/{sessionId}"],
  ["GET", "/auth/googleLogin"],
  ["GET", "/users/me"],
  ["PUT", "/users/me"],
  ["PUT", "/users/me/avatar"],
  ["GET", "/shops/browse"],
  ["GET", "/shops/me"],
  ["GET", "/shops/{shopId}"],
  ["POST", "/shops"],
  ["PUT", "/shops/{shopId}"],
  ["DELETE", "/shops/{shopId}"],
  ["PUT", "/shops/{shopId}/cover"],
  ["GET", "/shops/{shopId}/menu/{itemId}"],
  ["POST", "/shops/{shopId}/menu"],
  ["PUT", "/shops/{shopId}/menu/{itemId}"],
  ["DELETE", "/shops/{shopId}/menu/{itemId}"],
  ["PUT", "/shops/{shopId}/menu/{itemId}/img"],
  ["POST", "/shops/{shopId}/tables"],
  ["PUT", "/shops/{shopId}/tables/{tableId}"],
  ["DELETE", "/shops/{shopId}/tables/{tableId}"],
  ["GET", "/shops/{shopId}/sales"],
  ["GET", "/shops/{shopId}/tables/status"],
  ["GET", "/shops/{shopId}/tables/{tableId}/carts"],
  ["POST", "/shops/{shopId}/tables/{tableId}/carts/{cartId}/releaseSelection"],
  ["POST", "/shops/{shopId}/tables/{tableId}/carts/{cartId}/removeItem"],
  ["POST", "/shops/{shopId}/tables/{tableId}/carts/{cartId}/close"],
  ["POST", "/shops/{shopId}/tables/{tableId}/carts/{cartId}/mergeInto"],
  ["POST", "/shops/{shopId}/carts/{cartId}/refunds"],
  ["POST", "/shops/{shopId}/carts/{cartId}/refunds/{refundId}/retry"],
  ["POST", "/shops/{shopId}/carts/{cartId}/payments/{paymentId}/check"],
  ["POST", "/shops/{shopId}/paybacks/{paybackId}/done"],
  ["GET", "/carts/tables/{tableId}"],
  ["POST", "/carts/{shopId}/tables/{tableId}/addItem"],
  ["POST", "/carts/{shopId}/tables/{tableId}/removeItem"],
  ["POST", "/carts/{shopId}/tables/{tableId}/deleteItem"],
  ["POST", "/carts/{shopId}/tables/{tableId}/{cartId}/addSplitItem"],
  ["POST", "/carts/{shopId}/tables/{tableId}/{cartId}/decreaseSplitItem"],
  ["POST", "/carts/{shopId}/tables/{tableId}/{cartId}/removeSplitItem"],
  ["POST", "/carts/tables/{tableId}/{cartId}/createCheckoutOrder"],
  ["POST", "/carts/tables/{tableId}/{cartId}/captureCheckout"],
  ["POST", "/carts/tables/{tableId}/{cartId}/createStripeCheckout"],
  ["POST", "/carts/tables/{tableId}/{cartId}/captureStripeCheckout"],
]

const operations = new Set(
  Object.entries(spec.paths).flatMap(([p, methods]) => Object.keys(methods).map((m) => `${m.toUpperCase()} ${p}`))
)
const specPaths = Object.keys(spec.paths)

// Whether a path pattern fits another: segment by segment, a `{param}` on
// either side matching any one segment.
const segments = (p) => p.replace(/^\//, "").split("/")
const fits = (pattern, candidate) => {
  const a = segments(pattern)
  const b = segments(candidate)
  return a.length === b.length && a.every((s, i) => s.startsWith("{") || b[i].startsWith("{") || s === b[i])
}

// The path-looking string literals in the source files that talk to the API
// (those importing the axios instance or the upload helper, or reading the
// API's base URL), with every `${…}` as a `{p}` segment: a leading slash or at
// least two segments (a slice's name, "carts", is one word). Comments are
// stripped first, read in one pass with strings so neither hides the other.
const topSegments = new Set(specPaths.map((p) => segments(p)[0]))
const LITERAL = /`((?:\\.|\$\{[^}]*\}|[^`\\])*)`|"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g
const sweep = () => {
  const files = fs
    .readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f) && !f.startsWith("tests" + path.sep))
  const found = new Map()
  for (const file of files) {
    const text = fs.readFileSync(path.join(SRC, file), "utf8")
    if (!/backend\/backend["']|lib\/upload["']|VITE_BE_URL/.test(text)) continue
    const code = text.replace(new RegExp(`/\\*[\\s\\S]*?\\*/|//[^\\n]*|${LITERAL.source}`, "g"), (token) =>
      token.startsWith("/") ? "" : token
    )
    for (const m of code.matchAll(LITERAL)) {
      const literal = m[1] ?? m[2] ?? m[3]
      const p = literal.replace("${import.meta.env.VITE_BE_URL}", "").replace(/\$\{[^}]*\}/g, "{p}")
      if (!/^\/?[A-Za-z0-9_.{}-]+(\/[A-Za-z0-9_.{}-]+)*$/.test(p)) continue
      if (!p.startsWith("/") && !p.includes("/")) continue
      const normalised = "/" + p.replace(/^\//, "")
      if (!topSegments.has(segments(normalised)[0])) continue
      found.set(normalised, file)
    }
  }
  return found
}

describe("the API contract", () => {
  it("is the API's OpenAPI 3.1 document, of this app's MAJOR.MINOR", () => {
    expect(spec.openapi).toMatch(/^3\.1\./)
    const pair = (v) => v.split(".").slice(0, 2).join(".")
    expect({ api: pair(spec.info.version) }).toEqual({ api: pair(pkg.version) })
  })

  it("documents every operation the client calls", () => {
    const missing = CLIENT_CALLS.map(([m, p]) => `${m} ${p}`).filter((op) => !operations.has(op))
    expect(missing).toEqual([])
  })

  it("covers every API path the source names, and the list above names each of them", () => {
    const found = sweep()
    // The extraction works: the slices and the sheet alone name this many.
    expect(found.size).toBeGreaterThan(30)
    const unknown = [...found].filter(([p]) => !specPaths.some((s) => fits(p, s))).map(([p, f]) => `${f}: ${p}`)
    expect(unknown).toEqual([])
    const unlisted = [...found].filter(([p]) => !CLIENT_CALLS.some(([, c]) => fits(p, c))).map(([p, f]) => `${f}: ${p}`)
    expect(unlisted).toEqual([])
    // And nothing listed that the source no longer calls.
    const stale = CLIENT_CALLS.filter(([, c]) => ![...found.keys()].some((p) => fits(p, c))).map(([m, p]) => `${m} ${p}`)
    expect(stale).toEqual([])
  })
})
