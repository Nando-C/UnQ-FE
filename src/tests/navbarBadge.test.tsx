import { describe, it, expect } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import NavigationBar from "../components/Customers/NavigationBar/NavigationBar"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"

const menu = (id: string): IMenu => ({
  _id: id,
  name: `item-${id}`,
  image: "",
  short_description: "",
  description: "",
  price: 5,
  available: true,
  category: "food",
})

const cartWith = (items: ICart["items"]): ICart => ({
  _id: "cart1",
  userId: "u1",
  tableId: "t1",
  status: "open",
  items,
  split: [],
})

describe("NavigationBar cart badge", () => {
  it("shows the open-quantity sum and links to the cart when pointers are set", async () => {
    const cart = cartWith([
      { _id: "i1", menuId: menu("m1"), qty: 3, qtyPayed: 1 },
      { _id: "i2", menuId: menu("m2"), qty: 1, qtyPayed: undefined },
    ])
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart))
    )

    const { container } = renderWithProviders(<NavigationBar />, {
      preloadedState: {
        carts: { data: cart, pointers: { shopId: "s1", tableId: "t1" } },
      },
    })

    // (3-1) + (1-0) = 3
    const badge = await screen.findByText("3")
    expect(badge).toHaveClass("qty-indicator")
    expect(container.querySelector("a.cart-link")).not.toBeNull()
  })

  it("hides the badge when nothing is outstanding", async () => {
    const cart = cartWith([{ _id: "i1", menuId: menu("m1"), qty: 2, qtyPayed: 2 }])
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart))
    )

    const { container } = renderWithProviders(<NavigationBar />, {
      preloadedState: {
        carts: { data: cart, pointers: { shopId: "s1", tableId: "t1" } },
      },
    })

    await waitFor(() =>
      expect(container.querySelector(".qty-indicator")).toBeNull()
    )
    // Link is still present because pointers exist.
    expect(container.querySelector("a.cart-link")).not.toBeNull()
  })

  it("renders no cart link without pointers (S2 regression)", async () => {
    const { container } = renderWithProviders(<NavigationBar />, {
      preloadedState: {
        carts: {
          data: cartWith([]),
          pointers: { shopId: "", tableId: "" },
        },
      },
    })

    await waitFor(() =>
      expect(container.querySelector("span.cart-link")).not.toBeNull()
    )
    expect(container.querySelector("a.cart-link")).toBeNull()
  })
})
