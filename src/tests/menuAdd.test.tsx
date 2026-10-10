import { describe, it, expect } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import MenuItem from "../components/Customers/MenuItem/MenuItem"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"

const shop = {
  _id: "s1",
  name: "Shop",
  tables: [],
  menu: [{ _id: "m1", name: "Latte", image: "", short_description: "", description: "", price: 3, available: true, category: "drinks" }],
} as unknown as IShop

const me = { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" }

describe("the menu card's Add", () => {
  it("sends one order for a double tap, and says Added", async () => {
    let adds = 0
    let answer: () => void = () => {}
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/addItem`, async () => {
        adds++
        // Held until the test has tapped twice.
        await new Promise<void>((resolve) => (answer = resolve))
        return HttpResponse.json({ _id: "c1", userId: "u1", tableId: "t1", status: "open", items: [], split: [] })
      })
    )
    const { user } = renderWithProviders(<MenuItem shopId="s1" itemId="m1" />, {
      preloadedState: {
        user: { data: me, status: "authenticated" },
        shops: { data: [], selected: shop, selectedMenu: null },
      },
      route: "/shops/s1/tables/t1",
      path: "/shops/:shopId/tables/:tableId",
    })
    const add = screen.getByRole("button", { name: "Add" })

    await user.click(add)
    await user.click(add)
    await waitFor(() => expect(adds).toBe(1))
    expect(add).toBeDisabled()
    answer()

    expect(await screen.findByRole("button", { name: "Added" })).toBeEnabled()
    expect(adds).toBe(1)
  })
})
