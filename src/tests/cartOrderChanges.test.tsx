import { describe, it, expect, afterEach, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { http, HttpResponse } from "msw"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import { takeReturnTo } from "../lib/returnTo"
import { makeStore } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"
import type { IUser } from "../typings/user"

const menu = (id: string): IMenu => ({
  _id: id,
  name: `item-${id}`,
  image: "",
  short_description: "",
  description: "",
  price: 3,
  available: true,
  category: "food",
})

const me = { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" } as IUser
const guest = { _id: "", name: "", surname: "", email: "", avatar: "", role: "" } as unknown as IUser

// m1 × 3, nothing paid; `split` is who has selected what to pay for.
const cartWith = (qty: number, split: ICart["split"] = []): ICart => ({
  _id: "c1",
  userId: "u1",
  tableId: "t1",
  status: "open",
  items: [{ _id: "i1", menuId: menu("m1"), qty, qtyPayed: 0 }],
  split,
})
const anaHolds = (qty: number): ICart["split"] => [
  { _id: "s-ana", userId: "u2", menuId: menu("m1"), qty, splitStatus: "open" },
]

const renderCart = (cart: ICart, user = me) => {
  const store = makeStore({
    user: { data: user, status: user._id ? "authenticated" : "idle" },
    carts: { data: structuredClone(cart), pointers: { shopId: "s1", tableId: "t1" } },
  })
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={["/shops/s1/tables/t1/cart"]}>
        <Routes>
          <Route path="/shops/:shopId/tables/:tableId/cart" element={<CartListItems />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  return { store, user: userEvent.setup() }
}

const oneLess = () => screen.getByRole("button", { name: "Order one less item-m1" })
const bin = () => screen.getByRole("button", { name: "Remove item-m1 from the cart" })

// What the page's own fetch of the table's cart (on mount, on focus) answers.
let tableCart: ICart
let fetches = 0
beforeEach(() => {
  tableCart = cartWith(3)
  fetches = 0
  server.use(
    http.get(`${BASE}/carts/tables/t1`, () => {
      fetches++
      return HttpResponse.json(tableCart)
    })
  )
})
// The mount's fetch has answered, so it can't land on top of what a test does.
const loaded = async () => {
  await waitFor(() => expect(fetches).toBeGreaterThan(0))
  await new Promise((r) => setTimeout(r, 0))
}
afterEach(() => sessionStorage.clear())

describe("changing the table's order from the cart", () => {
  it("− orders one less", async () => {
    let body: unknown
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/removeItem`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(cartWith(2))
      })
    )
    const { user, store } = renderCart(cartWith(3))
    await loaded()

    await user.click(oneLess())

    expect(body).toEqual({ menuId: "m1", qty: 1 })
    await waitFor(() => expect(store.getState().carts.data.items[0].qty).toBe(2))
  })

  it("− isn't offered for the last unpaid unit (that's the bin)", () => {
    renderCart(cartWith(1))
    expect(screen.queryByRole("button", { name: /Order one less/ })).not.toBeInTheDocument()
    expect(bin()).toBeInTheDocument()
  })

  it("says why when − would take a unit someone is paying for, and shows the cart as it is", async () => {
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/removeItem`, () =>
        HttpResponse.json({ message: "Those units are already paid for or selected for payment" }, { status: 409 })
      )
    )
    const { user, store } = renderCart(cartWith(3))
    await loaded()
    // Meanwhile Ana selected all three.
    tableCart = cartWith(3, anaHolds(3))

    await user.click(oneLess())

    expect(await screen.findByText("Someone at the table is paying for those.")).toBeInTheDocument()
    await waitFor(() => expect(store.getState().carts.data.split).toHaveLength(1))
  })

  it("the bin says how many it kept for the diners paying for them", async () => {
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/deleteItem`, () => HttpResponse.json(cartWith(1, anaHolds(1))))
    )
    tableCart = cartWith(3, anaHolds(1))
    const { user } = renderCart(tableCart)
    await loaded()

    await user.click(bin())

    expect(await screen.findByText("1 kept: someone at the table is paying for them.")).toBeInTheDocument()
  })

  it("the bin's refusals are shown, not swallowed", async () => {
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/deleteItem`, () =>
        HttpResponse.json({ message: "The cart changed, please retry" }, { status: 409 })
      )
    )
    const { user } = renderCart(cartWith(3))
    await loaded()

    await user.click(bin())

    expect(await screen.findByText("The cart changed, please retry")).toBeInTheDocument()
  })
})

describe("a guest on the table's cart", () => {
  it("is sent to sign in, and back here after, when ticking an item to pay for", async () => {
    const { user } = renderCart(cartWith(3), guest)

    await user.click(screen.getByRole("checkbox", { name: "Select item-m1 to pay" }))

    expect(screen.getByText("login page")).toBeInTheDocument()
    expect(takeReturnTo()).toBe("/shops/s1/tables/t1/cart")
  })

  it("is sent to sign in when using the bin, instead of it failing silently", async () => {
    const { user } = renderCart(cartWith(3), guest)

    await user.click(bin())

    expect(screen.getByText("login page")).toBeInTheDocument()
  })
})
