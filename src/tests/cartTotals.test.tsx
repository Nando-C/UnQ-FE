import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"

const menu = (id: string, price: number): IMenu => ({
  _id: id,
  name: `item-${id}`,
  image: "",
  short_description: "",
  description: "",
  price,
  available: true,
  category: "food",
})

// Cart total = 2*4.5 + 1*3 = 12
// open split = 1*4.5 = 4.5  (to pay now)
// closed split = 1*3 = 3    (already paid)
// Remaining = 12 - 3 - 4.5 = 4.5
const fixtureCart: ICart = {
  _id: "cart1",
  userId: "u1",
  tableId: "t1",
  status: "open",
  items: [
    { _id: "i1", menuId: menu("m1", 4.5), qty: 2, qtyPayed: undefined },
    // Paid (the closed split s2), so qtyPayed is 1, as a settled checkout leaves it.
    { _id: "i2", menuId: menu("m2", 3), qty: 1, qtyPayed: 1 },
  ],
  split: [
    {
      _id: "s1",
      userId: "u1",
      menuId: menu("m1", 4.5),
      qty: 1,
      splitStatus: "open",
    },
    {
      _id: "s2",
      userId: "u1",
      menuId: menu("m2", 3),
      qty: 1,
      splitStatus: "closed",
    },
  ],
}

describe("CartListItems totals", () => {
  it("renders Cart total, Remaining, and Total paid from the reduce math", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(fixtureCart))
    )

    renderWithProviders(<CartListItems handleShowFbk={() => {}} />, {
      preloadedState: {
        user: {
          data: { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" },
          status: "authenticated",
        },
        carts: { data: fixtureCart, pointers: { shopId: "s1", tableId: "t1" } },
      },
      route: "/shops/s1/tables/t1/cart",
      path: "/shops/:shopId/tables/:tableId/cart",
    })

    // Once any open split exists the header switches to "Remaining cart total".
    expect(await screen.findByText(/Remaining cart total/)).toHaveTextContent(
      "£4.50"
    )
    expect(screen.getByText(/Total paid/)).toHaveTextContent("£3.00")
    // The Check out button shows my own open-split total (all of it is mine here).
    expect(screen.getByRole("button", { name: /Check out/ })).toHaveTextContent(
      "£4.50"
    )
  })
})
