import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { Route, Routes } from "react-router-dom"
import { http, HttpResponse } from "msw"
import App from "../App"
import Cart from "../components/Customers/Cart/Cart"
import TableMenu from "../components/Customers/TableMenu/TableMenu"
import AllShopsList from "../components/Customers/AllShopsList/AllShopsList"
import ShopList from "../components/Shops/ShopList/ShopList"
import { getTableCart } from "../redux/slices/cartSlice"
import { fetchSingleShop } from "../redux/slices/shopSlice"
import { makeStore, renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"
import type { IShop } from "../typings/shop"

const latte: IMenu = { _id: "m1", name: "Latte", image: "", short_description: "Hot", description: "", price: 3, available: true, category: "drinks" }
const cafe = { _id: "s1", name: "Cafe", cover: "", bio: "Coffee", menu: [latte], tables: [{ _id: "t1", name: "Window", Qr_Url: "" }] } as unknown as IShop
const other = { ...cafe, _id: "s2", name: "Other Place", tables: [] } as IShop
const cart: ICart = {
  _id: "c1", userId: "u1", tableId: "t1", status: "open",
  items: [{ _id: "i1", menuId: latte, qty: 1, qtyPayed: 0 }], split: [],
}
const emptyCart: ICart = { _id: "", userId: "", tableId: "", status: "", items: [], split: [] }

// Holds a request until the test lets it through.
const gate = () => {
  let open!: () => void
  const opened = new Promise<void>((r) => (open = r))
  return { open, opened }
}

const renderCart = () =>
  renderWithProviders(
    <Routes>
      <Route path="/shops/:shopId/tables/:tableId/cart" element={<Cart />} />
      <Route path="/shops/:shopId/tables/:tableId" element={<p>table menu</p>} />
    </Routes>,
    { route: "/shops/s1/tables/t1/cart", preloadedState: { carts: { data: emptyCart, pointers: { shopId: "s1", tableId: "t1" } } } }
  )

describe("the cart page", () => {
  it("shows placeholders, not 'No open orders', until the table's cart has loaded", async () => {
    const answer = gate()
    server.use(
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe)),
      http.get(`${BASE}/carts/tables/t1`, async () => {
        await answer.opened
        return HttpResponse.json({ message: "Cart Not Found!" }, { status: 404 })
      })
    )
    const { user } = renderCart()

    expect(screen.getByText("Loading the table's cart")).toBeInTheDocument()
    expect(screen.queryByText("No open orders")).not.toBeInTheDocument()

    answer.open()
    expect(await screen.findByText("No open orders")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Back to the menu" }))
    expect(await screen.findByText("table menu")).toBeInTheDocument()
  })

  it("offers to try again when the cart can't be loaded, and shows it once it can", async () => {
    let fail = true
    server.use(
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe)),
      http.get(`${BASE}/carts/tables/t1`, () =>
        fail ? HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }) : HttpResponse.json(cart)
      )
    )
    const { user } = renderCart()

    expect(await screen.findByText("Couldn't load this table's cart.")).toBeInTheDocument()
    expect(screen.queryByText("No open orders")).not.toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Latte")).toBeInTheDocument()
  })

  it("keeps the last answer when a later refresh of the same table fails", async () => {
    let fail = false
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () =>
        fail
          ? HttpResponse.json({ message: "Generic Server Error" }, { status: 500 })
          : HttpResponse.json({ message: "Cart Not Found!" }, { status: 404 })
      )
    )
    const store = makeStore()

    await store.dispatch(getTableCart("t1"))
    fail = true
    await store.dispatch(getTableCart("t1"))

    expect(store.getState().carts.loaded).toEqual({ tableId: "t1", failed: false })
  })

  it("counts no table as answered once moving to another table clears the cart", async () => {
    const answer = gate()
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart)),
      http.get(`${BASE}/carts/tables/t2`, async () => {
        await answer.opened
        return HttpResponse.json({ message: "Cart Not Found!" }, { status: 404 })
      })
    )
    const store = makeStore()

    await store.dispatch(getTableCart("t1"))
    const toT2 = store.dispatch(getTableCart("t2"))

    // Back to t1 now would otherwise count t1's cleared cart as its answer.
    expect(store.getState().carts.loaded).toBeUndefined()
    answer.open()
    await toT2
  })

  it("names the table even when the store still holds another shop", async () => {
    server.use(
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe)),
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart))
    )
    renderWithProviders(<Cart />, {
      route: "/shops/s1/tables/t1/cart",
      path: "/shops/:shopId/tables/:tableId/cart",
      preloadedState: { shops: { all: [], data: [], selected: other, selectedMenu: null } },
    })

    expect(await screen.findByText("Table: Window")).toBeInTheDocument()
  })
})

describe("opening one shop after another", () => {
  it("keeps the latest shop when an earlier one answers late, or fails late", async () => {
    const late = gate()
    server.use(
      http.get(`${BASE}/shops/s2`, async () => {
        await late.opened
        return HttpResponse.json({ message: "Generic Server Error" }, { status: 500 })
      }),
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe))
    )
    const store = makeStore()

    const first = store.dispatch(fetchSingleShop("s2"))
    await store.dispatch(fetchSingleShop("s1"))
    late.open()
    await first

    expect(store.getState().shops.selected?._id).toBe("s1")
    expect(store.getState().shops.selectedFailed).toBeUndefined()
  })

  it("ignores an earlier shop's answer that lands after the latest one", async () => {
    const late = gate()
    server.use(
      http.get(`${BASE}/shops/s2`, async () => {
        await late.opened
        return HttpResponse.json(other)
      }),
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe))
    )
    const store = makeStore()

    const first = store.dispatch(fetchSingleShop("s2"))
    await store.dispatch(fetchSingleShop("s1"))
    late.open()
    await first

    expect(store.getState().shops.selected?._id).toBe("s1")
  })
})

describe("a shop's menu", () => {
  const renderMenu = (selected: IShop | null) =>
    renderWithProviders(<TableMenu />, {
      route: "/shops/s1/tables/t1",
      path: "/shops/:shopId/tables/:tableId",
      preloadedState: { shops: { all: [], data: [], selected, selectedMenu: null } },
    })

  it("shows placeholders, never the shop opened before, until this one arrives", async () => {
    const answer = gate()
    server.use(
      http.get(`${BASE}/shops/s1`, async () => {
        await answer.opened
        return HttpResponse.json(cafe)
      })
    )
    renderMenu(other)

    expect(screen.getByText("Loading the menu")).toBeInTheDocument()
    expect(screen.queryByText("Other Place")).not.toBeInTheDocument()

    answer.open()
    expect(await screen.findByText("Cafe")).toBeInTheDocument()
    expect(screen.getByText("Latte")).toBeInTheDocument()
    expect(screen.queryByText("Loading the menu")).not.toBeInTheDocument()
  })

  it("offers to try again when the menu can't be loaded", async () => {
    let fail = true
    server.use(
      http.get(`${BASE}/shops/s1`, () =>
        fail ? HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }) : HttpResponse.json(cafe)
      )
    )
    const { user } = renderMenu(null)

    expect(await screen.findByText("Couldn't load this menu.")).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Latte")).toBeInTheDocument()
  })

  it("says when nothing matches the search, and clears it", async () => {
    server.use(http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe)))
    const { user } = renderMenu(cafe)

    await user.type(screen.getByLabelText("Search Menu"), "tea")
    expect(screen.getByText(/No dishes match “tea”/)).toBeInTheDocument()
    expect(screen.queryByText("Latte")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Clear search" }))
    expect(screen.getByText("Latte")).toBeInTheDocument()
    expect(screen.queryByText(/No dishes match/)).not.toBeInTheDocument()
  })
})

describe("the shop list", () => {
  it("shows placeholders until the shops arrive", () => {
    renderWithProviders(<AllShopsList />, { preloadedState: { shops: { all: [], data: [], selected: null, selectedMenu: null, allStatus: "loading" } } })

    expect(screen.getByText("Loading shops")).toBeInTheDocument()
  })

  it("says when no shop matches the search", async () => {
    const { user } = renderWithProviders(<AllShopsList />, {
      preloadedState: { shops: { all: [cafe], data: [], selected: null, selectedMenu: null, allStatus: "ready" } },
    })

    await user.type(screen.getByLabelText("Search Shop"), "pizza")

    expect(screen.getByText(/No shops match “pizza”/)).toBeInTheDocument()
  })

  it("offers to try again when the shops can't be loaded", async () => {
    server.use(http.get(`${BASE}/shops/`, () => HttpResponse.json([cafe])))
    const { user } = renderWithProviders(<AllShopsList />, {
      preloadedState: { shops: { all: [], data: [], selected: null, selectedMenu: null, allStatus: "failed" } },
    })

    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByText("Cafe")).toBeInTheDocument()
  })

  it("on My Shops, shows placeholders until the manager's shops arrive", () => {
    renderWithProviders(<ShopList />, { preloadedState: { shops: { all: [], data: [], selected: null, selectedMenu: null, dataStatus: "loading" } } })

    expect(screen.getByText("Loading your shops")).toBeInTheDocument()
  })
})

describe("an address no page answers", () => {
  it("says the page wasn't found and links home", async () => {
    window.history.pushState({}, "", "/no-such-page")
    render(
      <Provider store={makeStore()}>
        <App />
      </Provider>
    )

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/")
    window.history.pushState({}, "", "/")
  })
})
