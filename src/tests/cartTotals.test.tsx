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

// Cart Total = 2*4.5 + 1*3 = 12
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
    { _id: "i2", menuId: menu("m2", 3), qty: 1, qtyPayed: 0 },
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
  it("renders Cart Total, Remaining, and Total Payed from the reduce math", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(fixtureCart))
    )

    renderWithProviders(<CartListItems />, {
      preloadedState: {
        carts: { data: fixtureCart, pointers: { shopId: "s1", tableId: "t1" } },
      },
      route: "/shops/s1/tables/t1/cart",
      path: "/shops/:shopId/tables/:tableId/cart",
    })

    // Once any open split exists the header switches to "Remaining Cart Total".
    expect(await screen.findByText(/Remaining Cart Total/)).toHaveTextContent(
      "£4.50"
    )
    expect(screen.getByText(/Total Payed/)).toHaveTextContent("£3.00")
    // CheckOut button shows the open-split total.
    expect(screen.getByRole("button", { name: /CheckOut/ })).toHaveTextContent(
      "£4.50"
    )
  })
})
