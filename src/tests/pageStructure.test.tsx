import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { ReactElement } from "react"
import { http, HttpResponse } from "msw"
import App from "../App"
import Login from "../components/Login/Login"
import Register from "../components/Register/Register"
import Dashboard from "../components/Dashboard/Dashboard"
import TableMenu from "../components/Customers/TableMenu/TableMenu"
import Cart from "../components/Customers/Cart/Cart"
import Account from "../components/Customers/Account/Account"
import ShopDetails from "../components/Shops/ShopDetails/ShopDetails"
import NotFound from "../components/NotFound/NotFound"
import { makeStore, renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"
import type { RootState } from "../redux/app/store"

const latte = { _id: "m1", name: "Latte", image: "", short_description: "Hot", description: "", price: 3, available: true, category: "drinks" }
const cafe = {
  _id: "s1", name: "Cafe", cover: "", bio: "", open_times: "", phone: "", web_URL: "",
  shopMg: [], menu: [latte], tables: [{ _id: "t1", name: "Window", Qr_Url: "" }],
} as unknown as IShop
const diner = { _id: "u1", name: "Ada", surname: "L", email: "a@b.c", avatar: "", role: "customer" }
const manager = { ...diner, role: "shopMg" }

beforeEach(() => {
  server.use(
    http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe)),
    http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])),
    http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])),
    http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json({ message: "Cart Not Found!" }, { status: 404 }))
  )
})

type Case = [name: string, ui: ReactElement, route: string, path: string | undefined, state: Partial<RootState>, title: string, h1: string]
const cases: Case[] = [
  ["log in", <Login />, "/login", undefined, {}, "Log in · UnQ", "Log in"],
  ["sign up", <Register />, "/register", undefined, {}, "Sign up · UnQ", "Sign up"],
  ["the shop list", <Dashboard />, "/", undefined, { user: { data: diner, status: "authenticated" } }, "Shops · UnQ", "Shops"],
  ["My Shops", <Dashboard />, "/", undefined, { user: { data: manager, status: "authenticated" } }, "My Shops · UnQ", "My Shops"],
  ["a table's menu", <TableMenu />, "/shops/s1/tables/t1", "/shops/:shopId/tables/:tableId", {}, "Cafe · UnQ", "Cafe"],
  ["a table's cart", <Cart />, "/shops/s1/tables/t1/cart", "/shops/:shopId/tables/:tableId/cart", {}, "Cart · Table Window · UnQ", "Table: Window"],
  ["the account", <Account />, "/myAccount", undefined, { user: { data: diner, status: "authenticated" } }, "Account · UnQ", "Account"],
  ["a manager's shop", <ShopDetails />, "/shop/s1", "/shop/:shopId", { user: { data: manager, status: "authenticated" } }, "Manage Cafe · UnQ", "Cafe"],
  ["page not found", <NotFound />, "/nope", undefined, {}, "Page not found · UnQ", "Page not found"],
]

describe("every page", () => {
  it.each(cases)("%s has one h1 and its own tab title", async (_name, ui, route, path, state, title, h1) => {
    // Pages that reload "who am I" get the same user back.
    if (state.user) server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(state.user!.data)))
    renderWithProviders(ui, { route, path, preloadedState: state })

    await waitFor(() => expect(document.title).toBe(title))
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(h1))
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  })
})

describe("the app shell", () => {
  it("puts the page in one main region, reached by a skip link that comes first", async () => {
    window.history.pushState({}, "", "/")
    render(
      <Provider store={makeStore()}>
        <App />
      </Provider>
    )

    expect(screen.getAllByRole("main")).toHaveLength(1)
    await userEvent.setup().tab()
    const skip = screen.getByRole("link", { name: "Skip to content" })
    expect(skip).toHaveFocus()
    expect(skip).toHaveAttribute("href", "#main")
    expect(document.getElementById("main")).toBe(screen.getByRole("main"))
  })
})
