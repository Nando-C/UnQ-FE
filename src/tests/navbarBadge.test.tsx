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

describe("NavigationBar current page", () => {
  const cart = cartWith([{ _id: "i1", menuId: menu("m1"), qty: 2, qtyPayed: 0 }])
  const renderAt = (route: string) => {
    server.use(http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart)))
    return renderWithProviders(<NavigationBar />, {
      preloadedState: {
        carts: { data: cart, pointers: { shopId: "s1", tableId: "t1" } },
      },
      route,
    })
  }

  it("marks the cart as the current page on the cart route, and nothing else", async () => {
    renderAt("/shops/s1/tables/t1/cart")

    const cartLink = await screen.findByRole("link", { name: "Cart, 2 items" })
    expect(cartLink).toHaveAttribute("aria-current", "page")
    expect(cartLink).toHaveClass("active")
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("link", { name: "Account" })).not.toHaveAttribute("aria-current")
  })

  it("does not light Home on a shop's menu page", () => {
    renderAt("/shops/s1/tables/t1")

    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current")
  })

  it("lights Home on the shop list", () => {
    renderAt("/")

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page")
  })
})
