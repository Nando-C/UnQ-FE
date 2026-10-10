import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import TableList from "../components/Tables/TableList/TableList"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"

// The table's QR code and the shop's cover in its middle (SingleTable). The
// library draws nothing until the cover has loaded, and never if it can't, so
// the card loads the cover itself and draws the code with it, without it, or
// plain while it's slow.

// Every update() the cards ask of the library.
const updates: { data?: string; image?: string }[] = []
vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update(options: { data?: string; image?: string }) {
      updates.push(options)
    }
  },
}))

// jsdom never loads an image: this Image ends the way the test says.
let outcome: "load" | "error" | "never" = "load"
class FakeImage {
  crossOrigin = ""
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_value: string) {
    if (outcome === "never") return
    setTimeout(() => (outcome === "load" ? this.onload : this.onerror)?.(), 0)
  }
}

const shop = (cover: string) =>
  ({ _id: "s1", name: "Cafe", cover, tables: [{ _id: "t1", name: "1", Qr_Url: "https://x/t1" }], menu: [] }) as unknown as IShop

const renderTable = (cover: string) =>
  renderWithProviders(<TableList shopId="s1" />, {
    preloadedState: { shops: { data: [shop(cover)], selected: shop(cover), selectedMenu: null } },
  })

const COVER = "https://pictures.example/cover.jpg"
const RealImage = globalThis.Image

beforeEach(() => {
  updates.length = 0
  globalThis.Image = FakeImage as unknown as typeof Image
  server.use(http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])))
})
afterEach(() => {
  globalThis.Image = RealImage
  vi.useRealTimers()
})

describe("a table's QR code", () => {
  it("is drawn with the shop's cover once it has loaded", async () => {
    outcome = "load"
    renderTable(COVER)
    await screen.findByRole("button", { name: "View table 1" })
    await waitFor(() => expect(updates.at(-1)).toEqual({ data: "https://x/t1", image: COVER }))
  })

  it("is drawn without the cover when the cover can't be loaded", async () => {
    outcome = "error"
    renderTable(COVER)
    await screen.findByRole("button", { name: "View table 1" })
    await waitFor(() => expect(updates.at(-1)).toEqual({ data: "https://x/t1", image: "" }))
    expect(updates.some((u) => u.image === COVER)).toBe(false)
  })

  it("is drawn plain while a slow cover loads", async () => {
    vi.useFakeTimers()
    outcome = "never"
    renderTable(COVER)
    expect(updates).toEqual([])
    await vi.advanceTimersByTimeAsync(4000)
    expect(updates.at(-1)).toEqual({ data: "https://x/t1", image: "" })
  })

  it("is drawn plain at once when the shop has no cover of its own", async () => {
    renderTable("")
    await screen.findByRole("button", { name: "View table 1" })
    expect(updates.at(-1)).toEqual({ data: "https://x/t1", image: "" })
  })
})
