import { describe, it, expect, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import ShopModal from "../components/Shops/ShopModal/ShopModal"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"

const shopWith = (over: Partial<IShop> = {}) =>
  ({ _id: "s1", name: "Cafe", menu: [], tables: [], shopMg: [], ...over }) as unknown as IShop

let sent: Record<string, unknown>[] = []

beforeEach(() => {
  sent = []
  server.use(
    http.put(`${BASE}/shops/s1`, async ({ request }) => {
      sent.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json({})
    }),
    http.get(`${BASE}/shops/me`, () => HttpResponse.json([]))
  )
})

const openEditor = (shop: IShop) =>
  renderWithProviders(<ShopModal show shopId="s1" handleClose={() => {}} />, {
    preloadedState: { shops: { data: [shop], selected: shop, selectedMenu: null } },
  })

describe("editing a shop's phone number", () => {
  it("leaves the field empty for a shop without one, and saves", async () => {
    const { user } = openEditor(shopWith())

    expect(screen.getByPlaceholderText("Phone Number")).toHaveValue("")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent).toHaveLength(1)
    expect(sent[0].phone).toBe("")
  })

  it("sends the number as typed, leading 0 and spaces included", async () => {
    const { user } = openEditor(shopWith())

    await user.type(screen.getByPlaceholderText("Phone Number"), " 0161 496 0000 ")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent[0].phone).toBe("0161 496 0000")
  })

  it("clears a number", async () => {
    const { user } = openEditor(shopWith({ phone: "07700 900123" }))
    const field = screen.getByPlaceholderText("Phone Number")
    expect(field).toHaveValue("07700 900123")

    await user.clear(field)
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent[0].phone).toBe("")
  })

  it("shows the BE's reason for a number it refuses", async () => {
    server.use(
      http.put(`${BASE}/shops/s1`, () =>
        HttpResponse.json(
          { message: "Validation failed", details: [{ path: "phone", message: "Phone number can only contain digits, spaces, dashes and brackets" }] },
          { status: 400 }
        )
      )
    )
    const { user } = openEditor(shopWith())

    await user.type(screen.getByPlaceholderText("Phone Number"), "call me")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText("Phone number can only contain digits, spaces, dashes and brackets")).toBeInTheDocument()
  })
})
