import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { http, HttpResponse } from "msw"
import TableMenu from "../components/Customers/TableMenu/TableMenu"
import Cart from "../components/Customers/Cart/Cart"
import CheckOut from "../components/Customers/CheckOut/CheckOut"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import { getTableCart } from "../redux/slices/cartSlice"
import TableModal from "../components/Tables/TableModal/TableModal"
import { makeStore, renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"
import type { RootState } from "../redux/app/store"

// PayPal's SDK can't load in jsdom. Its button is stood in for by one that
// starts an order the way the SDK does, calling onError when that fails.
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ children }: { children: React.ReactNode }) => children,
  PayPalButtons: ({ createOrder, onError }: { createOrder: () => Promise<string>; onError: (e: unknown) => void }) => (
    <button onClick={() => createOrder().catch((e) => onError(e))}>Pay with PayPal</button>
  ),
}))

const latte: IMenu = { _id: "m1", name: "Latte", image: "", short_description: "Hot", description: "", price: 3, available: true, category: "drinks" }
const me = { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" }
const shop = { _id: "s1", name: "Cafe", cover: "", menu: [latte], tables: [{ _id: "t1", name: "Window", Qr_Url: "" }] }
const emptyCart: ICart = { _id: "", userId: "", tableId: "", status: "", items: [], split: [] }
const cartWith = (split: ICart["split"] = []): ICart => ({
  _id: "c1", userId: "u1", tableId: "t1", status: "open",
  items: [{ _id: "i1", menuId: latte, qty: 2, qtyPayed: 0 }],
  split,
})

const renderRoutes = (entry: string, state: Partial<RootState>) => {
  const store = makeStore(state)
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/customer/shop/:shopId" element={<TableMenu />} />
          <Route path="/shops/:shopId/tables/:tableId" element={<p>table menu</p>} />
          <Route path="/shops/:shopId/tables/:tableId/cart" element={<Cart />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  return { store, user: userEvent.setup() }
}

beforeEach(() => {
  server.use(http.get(`${BASE}/shops/s1`, () => HttpResponse.json(shop)))
})

describe("opening a shop from the shop list", () => {
  it("takes a diner already at one of its tables back to that table", async () => {
    const { store } = renderRoutes("/customer/shop/s1", {
      carts: { data: emptyCart, pointers: { shopId: "s1", tableId: "t1" } },
    })

    expect(await screen.findByText("table menu")).toBeInTheDocument()
    expect(store.getState().carts.pointers).toEqual({ shopId: "s1", tableId: "t1" })
  })

  it("starts without a table at another shop", async () => {
    const { store } = renderRoutes("/customer/shop/s1", {
      carts: { data: emptyCart, pointers: { shopId: "s2", tableId: "t9" } },
    })

    expect(await screen.findByRole("button", { name: "Select table to place order" })).toBeInTheDocument()
    expect(store.getState().carts.pointers).toEqual({ shopId: "s1", tableId: "" })
  })
})

describe("the empty cart page", () => {
  it("shows why, when staff closed the table the diner was at", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () =>
        HttpResponse.json(
          { message: "Cart Not Found!", notices: [{ _id: "n1", at: new Date().toISOString(), message: "The staff closed this table." }] },
          { status: 404 }
        )
      )
    )
    renderRoutes("/shops/s1/tables/t1/cart", {
      user: { data: me, status: "authenticated" },
      carts: { data: emptyCart, pointers: { shopId: "s1", tableId: "t1" } },
    })

    expect(await screen.findByText("The staff closed this table.")).toBeInTheDocument()
    expect(screen.getByText("Looks like you don't have any open orders!!")).toBeInTheDocument()
  })

  it("shows nothing extra when there's nothing to tell", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json({ message: "Cart Not Found!", notices: [] }, { status: 404 }))
    )
    renderRoutes("/shops/s1/tables/t1/cart", {
      carts: { data: emptyCart, pointers: { shopId: "s1", tableId: "t1" } },
    })

    expect(await screen.findByText("Looks like you don't have any open orders!!")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(document.querySelectorAll(".CartNotices .alert")).toHaveLength(0)
  })
})

describe("staff notes on the empty cart", () => {
  const closedNote = { _id: "n1", at: new Date().toISOString(), message: "The staff closed this table." }

  it("are dropped on moving to another table, even when its cart fails to load", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json({ message: "Cart Not Found!", notices: [closedNote] }, { status: 404 })),
      http.get(`${BASE}/carts/tables/t2`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }))
    )
    const store = makeStore()

    await store.dispatch(getTableCart("t1"))
    expect(store.getState().carts.data.notices?.map((n) => n.message)).toEqual(["The staff closed this table."])
    await store.dispatch(getTableCart("t2"))

    expect(store.getState().carts.data.notices ?? []).toEqual([])
    expect(store.getState().carts.data.items).toEqual([])
  })

  it("stay when the same table's cart briefly fails to load", async () => {
    let fail = false
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () =>
        fail
          ? HttpResponse.json({ message: "Generic Server Error" }, { status: 500 })
          : HttpResponse.json({ message: "Cart Not Found!", notices: [closedNote] }, { status: 404 })
      )
    )
    const store = makeStore()

    await store.dispatch(getTableCart("t1"))
    fail = true
    await store.dispatch(getTableCart("t1"))

    expect(store.getState().carts.data.notices?.map((n) => n.message)).toEqual(["The staff closed this table."])
  })

  it("don't make an empty cart look like one to order or pay from", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json({ message: "Cart Not Found!", notices: [closedNote] }, { status: 404 }))
    )
    const store = makeStore()

    await store.dispatch(getTableCart("t1"))

    const cart = store.getState().carts.data
    expect(cart._id).toBe("")
    expect(cart.items).toEqual([])
    expect(cart.split).toEqual([])
  })
})

describe("a checkout that can't start", () => {
  it("reloads the cart after any refusal, e.g. a selection staff released (404)", async () => {
    let fetches = 0
    server.use(
      http.post(`${BASE}/carts/tables/t1/c1/createCheckoutOrder`, () =>
        HttpResponse.json({ message: "No open split items to pay!" }, { status: 404 })
      ),
      http.get(`${BASE}/carts/tables/t1`, () => {
        fetches++
        return HttpResponse.json(cartWith())
      })
    )
    const handleShowFbk = vi.fn()
    const { user } = renderWithProviders(<CheckOut show handleClose={() => {}} handleShowFbk={handleShowFbk} />, {
      preloadedState: {
        carts: { data: cartWith([{ _id: "sp", userId: "u1", menuId: latte, qty: 1, splitStatus: "open" }]), pointers: { shopId: "s1", tableId: "t1" } },
      },
    })

    await user.click(screen.getByRole("button", { name: "Pay with PayPal" }))

    await waitFor(() => expect(handleShowFbk).toHaveBeenCalledWith("failure", "No open split items to pay! — nothing was charged."))
    await waitFor(() => expect(fetches).toBe(1))
  })
})

describe("the cart's bin", () => {
  it("empties the page when it took the last item and the cart went (204)", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cartWith())),
      http.post(`${BASE}/carts/s1/tables/t1/deleteItem`, () => new HttpResponse(null, { status: 204 }))
    )
    const store = makeStore({
      user: { data: me, status: "authenticated" },
      carts: { data: cartWith(), pointers: { shopId: "s1", tableId: "t1" } },
    })
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/shops/s1/tables/t1/cart"]}>
          <Routes>
            <Route path="/shops/:shopId/tables/:tableId/cart" element={<CartListItems />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    )
    await waitFor(() => expect(store.getState().carts.cartRequestId).toBeDefined())

    await userEvent.setup().click(screen.getByRole("button", { name: "Remove Latte from the cart" }))

    await waitFor(() => expect(store.getState().carts.data.items).toHaveLength(0))
    expect(store.getState().carts.data._id).toBe("")
  })
})

describe("selecting an item that sold out meanwhile", () => {
  it("says it sold out, not that someone else took it", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cartWith())),
      http.post(`${BASE}/carts/s1/tables/t1/c1/addSplitItem`, () =>
        HttpResponse.json({ message: "This item is sold out" }, { status: 409 })
      )
    )
    const store = makeStore({
      user: { data: me, status: "authenticated" },
      carts: { data: cartWith(), pointers: { shopId: "s1", tableId: "t1" } },
    })
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/shops/s1/tables/t1/cart"]}>
          <Routes>
            <Route path="/shops/:shopId/tables/:tableId/cart" element={<CartListItems />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    )

    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Select Latte to pay" }))

    expect(await screen.findByText("Sorry, that just sold out.")).toBeInTheDocument()
  })
})

describe("the Add Table dialog", () => {
  const renderNewTable = () => {
    let posts = 0
    server.use(
      http.post(`${BASE}/shops/s1/tables`, async () => {
        posts++
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json({ _id: "t2", name: "Patio", Qr_Url: "" })
      }),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([]))
    )
    const utils = renderWithProviders(<TableModal shopId="s1" tableId="new" show handleClose={() => {}} />)
    return { ...utils, posts: () => posts }
  }

  it("creates one table for a double tap on Create", async () => {
    const { user, posts } = renderNewTable()
    await user.type(screen.getByPlaceholderText("Name"), "Patio")

    await user.dblClick(screen.getByRole("button", { name: "Create Table" }))

    await waitFor(() => expect(posts()).toBe(1))
    await new Promise((r) => setTimeout(r, 100))
    expect(posts()).toBe(1)
  })

  it("creates the table on Enter, instead of sending a rename", async () => {
    const { user, posts } = renderNewTable()

    await user.type(screen.getByPlaceholderText("Name"), "Patio{Enter}")

    await waitFor(() => expect(posts()).toBe(1))
  })
})
