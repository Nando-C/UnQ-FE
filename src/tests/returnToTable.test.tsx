import { describe, it, expect, afterEach } from "vitest"
import { ReactElement } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { http, HttpResponse } from "msw"
import MenuItem from "../components/Customers/MenuItem/MenuItem"
import Register from "../components/Register/Register"
import Login from "../components/Login/Login"
import Dashboard from "../components/Dashboard/Dashboard"
import { rememberReturnTo, takeReturnTo } from "../lib/returnTo"
import { makeStore } from "./helpers"
import { server, BASE } from "./server"
import type { RootState } from "../redux/app/store"
import type { IShop } from "../typings/shop"

const shop = {
  _id: "s1",
  name: "Shop",
  tables: [],
  menu: [{ _id: "m1", name: "Latte", image: "", short_description: "", description: "", price: 3, available: true, category: "drinks" }],
} as unknown as IShop

const diner = { _id: "u1", name: "Ada", surname: "L", email: "a@b.c", avatar: "", role: "customer" }

// The app's routes that matter here, with the pages reduced to a marker.
const renderAt = (route: string, element: ReactElement, path: string, preloadedState?: Partial<RootState>) => {
  const store = makeStore(preloadedState)
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/" element={<p>shop list</p>} />
          <Route path="/shops/:shopId/tables/:tableId" element={<p>table page</p>} />
          <Route path="/shops/:shopId/tables/:tableId/cart" element={<p>cart page</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  return { store, user: userEvent.setup() }
}

afterEach(() => sessionStorage.clear())

describe("a diner who has to sign in at a table goes back to it", () => {
  it("after signing up (the page reloads on the way, losing the table in Redux)", async () => {
    const menuCard = renderAt("/shops/s1/tables/t1", <MenuItem shopId="s1" itemId="m1" />, "/shops/:shopId/tables/:tableId", {
      shops: { all: [], data: [], selected: shop, selectedMenu: null },
    })
    await menuCard.user.click(screen.getByRole("button", { name: "Add" }))
    expect(screen.getByText("login page")).toBeInTheDocument()

    // A fresh store: what the reload leaves.
    document.body.innerHTML = ""
    server.use(
      http.post(`${BASE}/auth/register`, () => HttpResponse.json({}, { status: 201 })),
      http.get(`${BASE}/users/me`, () => HttpResponse.json(diner))
    )
    const { user } = renderAt("/register", <Register />, "/register")
    await user.type(screen.getByPlaceholderText("First name"), "Ada")
    await user.type(screen.getByPlaceholderText("Last name"), "L")
    await user.type(screen.getByPlaceholderText("Enter email"), "a@b.c")
    await user.type(screen.getByPlaceholderText("Password"), "password123")
    await user.type(screen.getByPlaceholderText("Re-type Password"), "password123")
    await user.click(screen.getByRole("button", { name: /sign ?up|register/i }))

    expect(await screen.findByText("table page")).toBeInTheDocument()
    expect(takeReturnTo()).toBeNull()
  })

  it("after Google sign-in, which comes back to the site root", async () => {
    rememberReturnTo("/shops/s1/tables/t1/cart")
    server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(diner)))

    renderAt("/", <Dashboard />, "/")

    expect(await screen.findByText("cart page")).toBeInTheDocument()
  })

  it("from the login page reached from the table, whichever way they sign in", () => {
    renderAt("/login", <Login />, "/login", {
      carts: {
        data: { _id: "", userId: "", tableId: "", status: "", items: [], split: [] },
        pointers: { shopId: "s1", tableId: "t1" },
      },
    })

    expect(takeReturnTo()).toBe("/shops/s1/tables/t1")
    // Sign-up is an in-app link, not a page reload.
    expect(screen.getByRole("link", { name: "SignUp" })).toHaveAttribute("href", "/register")
  })

  it("to the table they're at now, not one from an earlier sign-in they didn't finish", () => {
    rememberReturnTo("/shops/s1/tables/t10")
    renderAt("/login", <Login />, "/login", {
      carts: {
        data: { _id: "", userId: "", tableId: "", status: "", items: [], split: [] },
        pointers: { shopId: "s1", tableId: "t1" },
      },
    })

    expect(takeReturnTo()).toBe("/shops/s1/tables/t1")
  })

  it("to the cart, when that's where this table's diner was sent to sign in from", () => {
    rememberReturnTo("/shops/s1/tables/t1/cart")
    renderAt("/login", <Login />, "/login", {
      carts: {
        data: { _id: "", userId: "", tableId: "", status: "", items: [], split: [] },
        pointers: { shopId: "s1", tableId: "t1" },
      },
    })

    expect(takeReturnTo()).toBe("/shops/s1/tables/t1/cart")
  })

  it("but not a signed-in visitor of the root with nothing remembered, nor from another site", async () => {
    sessionStorage.setItem("unq.returnTo", JSON.stringify({ path: "//evil.example", at: Date.now() }))
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(diner)),
      http.get(`${BASE}/shops/`, () => HttpResponse.json([]))
    )

    const { store } = renderAt("/", <Dashboard />, "/")

    // Signed in, and still on the shop list.
    await waitFor(() => expect(store.getState().user.data._id).toBe("u1"))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByText("table page")).not.toBeInTheDocument()
    expect(screen.queryByText("cart page")).not.toBeInTheDocument()
  })
})
