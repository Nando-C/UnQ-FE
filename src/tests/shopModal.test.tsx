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

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(sent).toHaveLength(1)
    expect(sent[0]).not.toHaveProperty("phone")
  })

  it("accepts spaces, dashes and brackets, sending the digits", async () => {
    const { user } = openEditor(shopWith())
    const field = screen.getByPlaceholderText("Phone Number")

    await user.type(field, "(0161) 496-0000")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent[0].phone).toBe(1614960000)
  })

  it("refuses letters", async () => {
    const { user } = openEditor(shopWith({ phone: 1614960000 }))
    const field = screen.getByPlaceholderText("Phone Number")
    expect(field).toHaveValue("1614960000")

    await user.type(field, "x")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText("Phone number can only contain digits, spaces, dashes and brackets")).toBeInTheDocument()
    expect(sent).toEqual([])
  })
})
