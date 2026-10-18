import { describe, it, expect, vi, afterEach } from "vitest"
import { ReactElement } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { http, HttpResponse } from "msw"
import ShopDetails from "../components/Shops/ShopDetails/ShopDetails"
import Account from "../components/Customers/Account/Account"
import MenuItem from "../components/Customers/MenuItem/MenuItem"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import Login from "../components/Login/Login"
import { ManagerOnly } from "../components/Common/Guards"
import { fetchUserData, logOut } from "../redux/slices/userSlice"
import { ownCover, BE_DEFAULT_COVER } from "../lib/cover"
import { peekReturnTo, rememberReturnTo } from "../lib/returnTo"
import placeholder from "../assets/placeholder.svg"
import { makeStore } from "./helpers"
import { server, BASE } from "./server"
import type { RootState } from "../redux/app/store"
import type { IShop } from "../typings/shop"
import type { ICart } from "../typings/cart"

vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update() {}
  },
}))

const diner = { _id: "u1", name: "Ada", surname: "L", email: "a@b.c", avatar: "", role: "customer" }
const manager = { ...diner, _id: "u2", role: "shopMg" }

// A shop whose second item has no description: the BE doesn't require one.
const cafe = {
  _id: "s1", name: "Cafe", cover: "", bio: "", open_times: "", phone: "", web_URL: "", shopMg: [],
  tables: [{ _id: "t1", name: "Window", Qr_Url: "" }],
  menu: [
    { _id: "m1", name: "Latte", image: "", short_description: "Hot", description: "Milky", price: 3, available: true, category: "drinks" },
    { _id: "m2", name: "Scone", image: "", short_description: "Baked", price: 2, available: true, category: "food" },
  ],
} as unknown as IShop

// The app's routes that matter here, the other pages reduced to a marker.
const renderAt = (
  route: string | { pathname: string; state: unknown },
  path: string,
  element: ReactElement,
  preloadedState?: Partial<RootState>
) => {
  const store = makeStore(preloadedState)
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/login" element={<p>login page</p>} />
          <Route path="/" element={<p>shop list</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  return { store, user: userEvent.setup() }
}

afterEach(() => sessionStorage.clear())

describe("the manager's menu search", () => {
  it("copes with an item that has no description", async () => {
    server.use(
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe)),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])),
      http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])),
      http.get(`${BASE}/shops/s1/staff`, () => HttpResponse.json({ members: [] })),
    )
    const { user } = renderAt("/shop/s1", "/shop/:shopId", <ShopDetails />, {
      user: { data: manager, status: "authenticated" },
    })

    await user.type(await screen.findByLabelText("Search Menu"), "zz")

    expect(await screen.findByText(/No menu items match/)).toBeInTheDocument()
  })
})

describe("the QR code's centre image", () => {
  it("is the shop's own cover, and none without one", () => {
    expect(ownCover("https://res.cloudinary.com/x/cover.jpg")).toBe("https://res.cloudinary.com/x/cover.jpg")
    expect(ownCover(BE_DEFAULT_COVER)).toBe("")
    expect(ownCover(placeholder)).toBe("")
    expect(ownCover("")).toBe("")
    expect(ownCover(undefined)).toBe("")
  })
})

describe("logging out", () => {
  const signedIn = (): Partial<RootState> => ({
    user: { data: manager, status: "authenticated" },
    shops: { data: [cafe], selected: null, selectedMenu: null },
    carts: {
      data: { _id: "", userId: "", tableId: "", status: "", items: [], split: [] },
      pointers: { shopId: "s1", tableId: "t1" },
      pending: { m1: 1 },
    },
  })

  it("forgets the account's shops, table and selections, then goes to sign in", async () => {
    server.use(http.get(`${BASE}/auth/logout`, () => HttpResponse.json({})))
    rememberReturnTo("/shops/s1/tables/t1")
    const { store, user } = renderAt("/myAccount", "/myAccount", <Account />, signedIn())

    await user.click(screen.getByRole("button", { name: "Log out" }))

    expect(await screen.findByText("login page")).toBeInTheDocument()
    const state = store.getState()
    expect(state.user.status).toBe("guest")
    expect(state.shops.data).toEqual([])
    expect(state.carts.pointers).toEqual({ shopId: "", tableId: "" })
    expect(state.carts.pending).toBeUndefined()
    expect(peekReturnTo()).toBeNull()
  })

  it("counts a session that had already ended as logged out", async () => {
    server.use(http.get(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 401 })))
    const { store, user } = renderAt("/myAccount", "/myAccount", <Account />, signedIn())

    await user.click(screen.getByRole("button", { name: "Log out" }))

    expect(await screen.findByText("login page")).toBeInTheDocument()
    expect(store.getState().user.status).toBe("guest")
  })

  it("isn't counted as done when another tab's refresh kept winning", async () => {
    server.use(
      http.get(`${BASE}/auth/logout`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE}/auth/refreshToken`, () =>
        HttpResponse.json({ message: "Invalid token", reason: "superseded" }, { status: 401 })
      )
    )
    const { store, user } = renderAt("/myAccount", "/myAccount", <Account />, signedIn())

    await user.click(screen.getByRole("button", { name: "Log out" }))

    expect(await screen.findByText(/Couldn't log out/)).toBeInTheDocument()
    expect(store.getState().user.status).toBe("authenticated")
  })

  it("stays signed in, and says so, when the logout doesn't go through", async () => {
    server.use(http.get(`${BASE}/auth/logout`, () => HttpResponse.json({}, { status: 500 })))
    const { store, user } = renderAt("/myAccount", "/myAccount", <Account />, signedIn())

    await user.click(screen.getByRole("button", { name: "Log out" }))

    expect(await screen.findByText(/Couldn't log out/)).toBeInTheDocument()
    expect(screen.queryByText("login page")).not.toBeInTheDocument()
    expect(store.getState().user.status).toBe("authenticated")
    expect(store.getState().shops.data).toHaveLength(1)
  })
})

describe("a manager's shop page", () => {
  const page = <ManagerOnly><p>manager page</p></ManagerOnly>

  it("sends a guest to sign in, and back here after", async () => {
    renderAt("/shop/s1", "/shop/:shopId", page, { user: { data: { ...diner, _id: "", role: "" }, status: "guest" } })

    expect(await screen.findByText("login page")).toBeInTheDocument()
    expect(peekReturnTo()).toBe("/shop/s1")
  })

  it("sends a diner to the shop list", async () => {
    renderAt("/shop/s1", "/shop/:shopId", page, { user: { data: diner, status: "authenticated" } })

    expect(await screen.findByText("shop list")).toBeInTheDocument()
  })

  it("shows the page to a manager, and while it isn't yet known who is signed in", async () => {
    const { store } = renderAt("/shop/s1", "/shop/:shopId", page, {
      user: { data: { ...diner, _id: "", role: "" }, status: "loading" },
    })
    expect(screen.getByText("manager page")).toBeInTheDocument()

    act(() => {
      store.dispatch(fetchUserData.fulfilled(manager, "check"))
    })
    expect(screen.getByText("manager page")).toBeInTheDocument()
  })
})

describe("changing an order before it's known who is signed in", () => {
  const menuState = (status: "loading" | "guest"): Partial<RootState> => ({
    user: { data: { ...diner, _id: "", role: "" }, status },
    shops: { data: [], selected: cafe, selectedMenu: null },
  })

  it("Add waits for the account, then adds", async () => {
    const adds: unknown[] = []
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/addItem`, async ({ request }) => {
        adds.push(await request.json())
        return HttpResponse.json({ _id: "c1", userId: "u1", tableId: "t1", status: "open", items: [], split: [] })
      })
    )
    const { store, user } = renderAt(
      "/shops/s1/tables/t1",
      "/shops/:shopId/tables/:tableId",
      <MenuItem shopId="s1" itemId="m1" />,
      menuState("loading")
    )

    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(screen.queryByText("login page")).not.toBeInTheDocument()
    expect(adds).toEqual([])

    act(() => {
      store.dispatch(fetchUserData.fulfilled(diner, "check"))
    })

    expect(await screen.findByRole("button", { name: "Added" })).toBeInTheDocument()
    expect(adds).toHaveLength(1)
  })

  it("Add sends a guest to sign in once it's known they are one", async () => {
    const { store, user } = renderAt(
      "/shops/s1/tables/t1",
      "/shops/:shopId/tables/:tableId",
      <MenuItem shopId="s1" itemId="m1" />,
      menuState("loading")
    )

    await user.click(screen.getByRole("button", { name: "Add" }))
    act(() => {
      store.dispatch(fetchUserData.rejected(null, "check", undefined, { signedOut: true }))
    })

    expect(await screen.findByText("login page")).toBeInTheDocument()
    expect(peekReturnTo()).toBe("/shops/s1/tables/t1")
  })
})

describe("Select All for a guest", () => {
  it("sends them to sign in instead of selecting", async () => {
    const splitAdds: unknown[] = []
    const cart: ICart = {
      _id: "c1", userId: "u9", tableId: "t1", status: "open",
      items: [{ _id: "i1", menuId: cafe.menu[0], qty: 2, qtyPayed: 0 }],
      split: [],
    }
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart)),
      http.post(`${BASE}/carts/:shopId/tables/:tableId/:cartId/addSplitItem`, async ({ request }) => {
        splitAdds.push(await request.json())
        return HttpResponse.json(cart)
      })
    )
    const { store, user } = renderAt(
      "/shops/s1/tables/t1/cart",
      "/shops/:shopId/tables/:tableId/cart",
      <CartListItems handleShowFbk={() => {}} />,
      {
        user: { data: { ...diner, _id: "", role: "" }, status: "guest" },
        carts: { data: structuredClone(cart), pointers: { shopId: "s1", tableId: "t1" } },
      }
    )

    await user.click(screen.getByRole("checkbox", { name: "Select All" }))

    expect(await screen.findByText("login page")).toBeInTheDocument()
    expect(peekReturnTo()).toBe("/shops/s1/tables/t1/cart")
    expect(store.getState().carts.pending).toBeUndefined()
    await waitFor(() => expect(splitAdds).toEqual([]))
  })
})

describe("signing in", () => {
  it("says what the BE found wrong with the form", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () =>
        HttpResponse.json(
          { message: "Validation failed", details: [{ path: "email", message: "Invalid email address" }] },
          { status: 400 }
        )
      )
    )
    const { user } = renderAt("/signin", "/signin", <Login />)

    await user.type(screen.getByPlaceholderText("Enter email"), "me@localhost")
    await user.type(screen.getByPlaceholderText("Password"), "x")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    expect(await screen.findByText("Invalid email address")).toBeInTheDocument()
  })
})

describe("a failed check of who is signed in", () => {
  it("keeps the user when it's a network error or a server fault", async () => {
    server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 })))
    const store = makeStore({ user: { data: manager, status: "authenticated" } })

    await store.dispatch(fetchUserData())

    expect(store.getState().user).toMatchObject({ data: manager, status: "authenticated" })
  })

  it("keeps the user when the session couldn't be refreshed for a server fault", async () => {
    server.use(
      http.get(`${BASE}/users/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE}/auth/refreshToken`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }))
    )
    const store = makeStore({ user: { data: manager, status: "authenticated" } })

    await store.dispatch(fetchUserData())

    expect(store.getState().user).toMatchObject({ data: manager, status: "authenticated" })
  })

  it("keeps the user when another tab's refresh kept winning (the session is still good)", async () => {
    server.use(
      http.get(`${BASE}/users/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE}/auth/refreshToken`, () =>
        HttpResponse.json({ message: "Invalid token", reason: "superseded" }, { status: 401 })
      )
    )
    const store = makeStore({ user: { data: manager, status: "authenticated" } })

    await store.dispatch(fetchUserData())

    expect(store.getState().user).toMatchObject({ data: manager, status: "authenticated" })
  })

  it("lets only the latest check decide, when several are sent at once", async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/users/me`, async () => {
        calls += 1
        // The first one sent answers last, saying signed out.
        if (calls === 1) {
          await new Promise((r) => setTimeout(r, 50))
          return HttpResponse.json({ message: "User not found!" }, { status: 404 })
        }
        return HttpResponse.json(manager)
      })
    )
    const store = makeStore()

    await Promise.all([store.dispatch(fetchUserData()), store.dispatch(fetchUserData())])

    expect(store.getState().user).toMatchObject({ data: manager, status: "authenticated" })
  })

  it("keeps a user an earlier check found when the latest one fails on a network blip", async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/users/me`, async () => {
        calls += 1
        // The latest one sent fails, after the earlier one found the manager.
        if (calls === 2) {
          await new Promise((r) => setTimeout(r, 50))
          return HttpResponse.error()
        }
        return HttpResponse.json(manager)
      })
    )
    const store = makeStore()

    await Promise.all([store.dispatch(fetchUserData()), store.dispatch(fetchUserData())])

    expect(store.getState().user).toMatchObject({ data: manager, status: "authenticated" })
  })

  it("applies an earlier check's success that arrives after the latest one failed on a blip", async () => {
    let calls = 0
    server.use(
      http.get(`${BASE}/users/me`, async () => {
        calls += 1
        // The earlier one answers last.
        if (calls === 1) {
          await new Promise((r) => setTimeout(r, 50))
          return HttpResponse.json(manager)
        }
        return HttpResponse.error()
      })
    )
    const store = makeStore()

    await Promise.all([store.dispatch(fetchUserData()), store.dispatch(fetchUserData())])

    expect(store.getState().user).toMatchObject({ data: manager, status: "authenticated" })
  })

  it("ignores a check sent before logging out", async () => {
    let answer: () => void = () => {}
    server.use(
      http.get(`${BASE}/users/me`, async () => {
        await new Promise<void>((r) => (answer = r))
        return HttpResponse.json(manager)
      }),
      http.get(`${BASE}/auth/logout`, () => HttpResponse.json({}))
    )
    const store = makeStore({ user: { data: manager, status: "authenticated" } })

    const check = store.dispatch(fetchUserData())
    await store.dispatch(logOut())
    answer()
    await check

    expect(store.getState().user.status).toBe("guest")
  })

  it("counts as signed out when the account is gone (404)", async () => {
    server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json({ message: "User not found!" }, { status: 404 })))
    const store = makeStore({ user: { data: manager, status: "authenticated" } })

    await store.dispatch(fetchUserData())

    expect(store.getState().user.status).toBe("guest")
  })

  it("counts as signed out when the BE says so (401)", async () => {
    const store = makeStore({ user: { data: manager, status: "authenticated" } })

    await store.dispatch(fetchUserData())

    expect(store.getState().user.status).toBe("guest")
    expect(store.getState().user.data._id).toBe("")
  })
})

describe("the page to go back to after signing in", () => {
  it("stays the manager's page they were sent from, not a table they once opened", () => {
    rememberReturnTo("/shop/s1")
    renderAt({ pathname: "/signin", state: { returnTo: "/shop/s1" } }, "/signin", <Login />, {
      carts: {
        data: { _id: "", userId: "", tableId: "", status: "", items: [], split: [] },
        pointers: { shopId: "s1", tableId: "t1" },
      },
    })

    expect(peekReturnTo()).toBe("/shop/s1")
  })

  it("is the table they're at, over a page left by an earlier sign-in they didn't finish", () => {
    rememberReturnTo("/shop/s1")
    renderAt("/signin", "/signin", <Login />, {
      carts: {
        data: { _id: "", userId: "", tableId: "", status: "", items: [], split: [] },
        pointers: { shopId: "s1", tableId: "t1" },
      },
    })

    expect(peekReturnTo()).toBe("/shops/s1/tables/t1")
  })
})
