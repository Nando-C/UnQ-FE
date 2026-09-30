import { describe, it, expect } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse, delay } from "msw"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import { getTableCart } from "../redux/slices/cartSlice"
import { makeStore, renderWithProviders } from "./helpers"
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

const me = { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" }

// Table t1: m1 £4.50 × 2 and m2 £3 × 1, nothing paid.
const cartFor = (tableId: string, split: ICart["split"] = []): ICart => ({
  _id: `cart-${tableId}`,
  userId: "u1",
  tableId,
  status: "open",
  items: [
    { _id: "i1", menuId: menu("m1", 4.5), qty: 2, qtyPayed: 0 },
    { _id: "i2", menuId: menu("m2", 3), qty: 1, qtyPayed: 0 },
  ],
  split,
})

const renderCart = (cart: ICart) =>
  renderWithProviders(<CartListItems handleShowFbk={() => {}} />, {
    preloadedState: {
      user: { data: me, status: "authenticated" },
      carts: { data: structuredClone(cart), pointers: { shopId: "s1", tableId: cart.tableId } },
    },
    route: `/shops/s1/tables/${cart.tableId}/cart`,
    path: "/shops/:shopId/tables/:tableId/cart",
  })

const checkout = () => screen.getByRole("button", { name: /Check out/ })

describe("Checkout amount", () => {
  it("shows only what I selected, not other diners' selections", async () => {
    // Another diner holds m1 (£4.50), I hold m2 (£3): PayPal would charge me £3.
    const cart = cartFor("t1", [
      { _id: "s-u2", userId: "u2", menuId: menu("m1", 4.5), qty: 1, splitStatus: "open" },
      { _id: "s-u1", userId: "u1", menuId: menu("m2", 3), qty: 1, splitStatus: "open" },
    ])
    server.use(http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart)))
    renderCart(cart)

    expect(checkout()).toHaveTextContent("£3.00")
    expect(checkout()).toBeEnabled()
    // The table's remaining total still counts everyone's selections.
    expect(screen.getByText(/Remaining cart total/)).toHaveTextContent("£4.50")
  })

  it("is off when I've selected nothing, even if others have", async () => {
    const cart = cartFor("t1", [
      { _id: "s-u2", userId: "u2", menuId: menu("m1", 4.5), qty: 1, splitStatus: "open" },
    ])
    server.use(http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart)))
    renderCart(cart)

    expect(checkout()).toHaveTextContent("£0.00")
    expect(checkout()).toBeDisabled()
  })
})

describe("the table's cart", () => {
  it("empties when the BE says the table has no open cart (paid off meanwhile)", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () =>
        HttpResponse.json({ message: "Cart Not Found!" }, { status: 404 })
      )
    )
    renderCart(cartFor("t1"))

    // Shown from the store at first, gone once the refetch answers 404.
    await waitFor(() => expect(screen.queryByText("item-m1")).not.toBeInTheDocument())
    expect(screen.queryByText("item-m2")).not.toBeInTheDocument()
  })

  it("keeps the last cart when the fetch fails for another reason", async () => {
    let answered = false
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => {
        answered = true
        return HttpResponse.json({ message: "boom" }, { status: 500 })
      })
    )
    renderCart(cartFor("t1"))

    await waitFor(() => expect(answered).toBe(true))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByText("item-m1")).toBeInTheDocument()
  })

  it("never shows the previous table's cart while the new one loads", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t2`, async () => {
        await delay(50)
        return HttpResponse.json(cartFor("t2"))
      })
    )
    const store = makeStore({
      user: { data: me, status: "authenticated" },
      carts: { data: structuredClone(cartFor("t1")), pointers: { shopId: "s1", tableId: "t1" } },
    })

    const loading = store.dispatch(getTableCart("t2"))
    expect(store.getState().carts.data._id).toBe("")
    expect(store.getState().carts.data.items).toEqual([])

    await loading
    expect(store.getState().carts.data._id).toBe("cart-t2")
  })

  it("ignores an older fetch that answers after a newer one", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, async () => {
        await delay(60)
        return HttpResponse.json(cartFor("t1"))
      }),
      http.get(`${BASE}/carts/tables/t2`, () => HttpResponse.json(cartFor("t2")))
    )
    const store = makeStore({ user: { data: me, status: "authenticated" } })

    const older = store.dispatch(getTableCart("t1"))
    await store.dispatch(getTableCart("t2"))
    await older

    expect(store.getState().carts.data._id).toBe("cart-t2")
  })
})
