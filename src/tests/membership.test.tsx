import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import { Provider } from "react-redux"
import { Route, Routes } from "react-router-dom"
import { http, HttpResponse } from "msw"
import App from "../App"
import Dashboard from "../components/Dashboard/Dashboard"
import Account from "../components/Customers/Account/Account"
import ShopModal from "../components/Shops/ShopModal/ShopModal"
import { AdminOnly, ManagerOnly } from "../components/Common/Guards"
import { fetchShopList, selectIsManager } from "../redux/slices/shopSlice"
import { fetchUserData, logOut } from "../redux/slices/userSlice"
import { roleLine } from "../lib/membership"
import { gate, makeStore, renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import { range, totals } from "./salesFixtures"
import type { RootState } from "../redux/app/store"
import type { IShop } from "../typings/shop"
import type { IUser } from "../typings/user"

// Who runs shops: an account with the shop manager or administrator role, or
// a member of a shop, which only the account's shops (GET /shops/me) say.
// The shell, My Shops, the manager pages' guard and the account page's line
// all read that, and the guard waits for the shops before it sends anyone away.

const ada: IUser = { _id: "u1", name: "Ada", surname: "L", email: "ada@example.com", avatar: "", role: "customer", hasPassword: true }
const sam: IUser = { ...ada, _id: "u2", name: "Sam", surname: "Demo", email: "sam@example.com", role: "shopMg" }
const root: IUser = { ...ada, _id: "u9", name: "Root", surname: "", email: "root@example.com", role: "admin" }
const since = "2026-10-01T09:00:00.000Z"
// Sam's café, where Ada is a manager.
const cafe = {
  _id: "s1", name: "Cafe", cover: "", bio: "", open_times: "", phone: "", web_URL: "", timeZone: "Europe/London",
  shopMg: ["u2", "u1"], ownerId: "u2",
  members: [{ userId: "u2", role: "owner", since }, { userId: "u1", role: "manager", since, addedBy: "u2" }],
  menu: [], tables: [],
} as IShop
// Ada's own deli.
const deli = { ...cafe, _id: "s2", name: "Deli", shopMg: ["u1"], ownerId: "u1", members: [{ userId: "u1", role: "owner", since }] } as IShop

const signedIn = (user: IUser, shops?: Partial<RootState["shops"]>): Partial<RootState> => ({
  user: { data: user, status: "authenticated" },
  ...(shops && { shops: { data: [], selected: null, selectedMenu: null, ...shops } }),
})

// The glance on each My Shops card.
const quietShop = () =>
  server.use(
    http.get(`${BASE}/shops/:shopId/tables/status`, () => HttpResponse.json([])),
    http.get(`${BASE}/shops/:shopId/sales`, () => HttpResponse.json({ range: range("2026-01-01", "2026-01-07", 7), totals: totals(), series: [], heatmap: [], items: [], refunds: { count: 0, byReason: [], byHour: [] }, tables: [] }))
  )

// A guest sent to sign in leaves where to come back to in sessionStorage,
// which the home page would then follow.
beforeEach(() => sessionStorage.clear())

describe("who runs shops", () => {
  const is = (state: Partial<RootState>) => selectIsManager(makeStore(state).getState())

  it("an administrator, by role, before any shop has loaded", () => {
    expect(is(signedIn(root))).toBe(true)
  })
  it("a shop manager, by role", () => {
    expect(is(signedIn(sam))).toBe(true)
  })
  it("a member of a shop, once the shops have loaded", () => {
    expect(is(signedIn(ada, { data: [cafe], dataStatus: "ready" }))).toBe(true)
  })
  it("not a diner", () => {
    expect(is(signedIn(ada, { data: [], dataStatus: "ready" }))).toBe(false)
  })
  it("not yet, while the shops are loading", () => {
    expect(is(signedIn(ada, { dataStatus: "loading" }))).toBe(false)
  })
  it("falls back to the role when the account signs out", () => {
    const store = makeStore(signedIn(ada, { data: [cafe], dataStatus: "ready" }))
    expect(selectIsManager(store.getState())).toBe(true)
    store.dispatch(logOut.fulfilled(undefined, "r"))
    expect(selectIsManager(store.getState())).toBe(false)
    expect(store.getState().shops.dataStatus).toBeUndefined()
  })
  it("forgets the shops when the session turns out to have ended, not on a blip", () => {
    const store = makeStore(signedIn(ada, { data: [cafe], dataStatus: "ready" }))
    store.dispatch(fetchUserData.rejected(null, "1", undefined, { signedOut: false }))
    expect(selectIsManager(store.getState())).toBe(true)
    store.dispatch(fetchUserData.rejected(null, "2", undefined, { signedOut: true }))
    expect(selectIsManager(store.getState())).toBe(false)
    expect(store.getState().shops.dataStatus).toBeUndefined()
  })
  it("drops a list that answers after the account signed out, so the next account's is asked for", () => {
    const store = makeStore(signedIn(ada))
    store.dispatch(fetchShopList.pending("1"))
    store.dispatch(logOut.fulfilled(undefined, "r"))
    store.dispatch(fetchShopList.fulfilled([cafe], "1"))
    expect(store.getState().shops.data).toEqual([])
    expect(store.getState().shops.dataStatus).toBeUndefined()
    store.dispatch(fetchShopList.pending("2"))
    store.dispatch(fetchShopList.fulfilled([deli], "2"))
    expect(store.getState().shops.data).toEqual([deli])
  })
})

const renderAt = (route: string, page: React.ReactElement, state: Partial<RootState>) =>
  renderWithProviders(
    <Routes>
      <Route path="/shop/:shopId" element={page} />
      <Route path="/admin/accounts" element={page} />
      <Route path="/" element={<p>shop list</p>} />
      <Route path="/login" element={<p>login page</p>} />
    </Routes>,
    { route, preloadedState: state }
  )

describe("a manager's page for an account without the manager role", () => {
  const page = <ManagerOnly><p>manager page</p></ManagerOnly>

  it("waits for the account's shops, and shows the page to a member", async () => {
    const shops = gate()
    server.use(http.get(`${BASE}/shops/me`, async () => { await shops.opened; return HttpResponse.json([cafe]) }))
    renderAt("/shop/s1", page, signedIn(ada))

    expect(await screen.findByRole("status")).toHaveTextContent("Loading your shops")
    expect(screen.queryByText("shop list")).not.toBeInTheDocument()
    expect(screen.queryByText("manager page")).not.toBeInTheDocument()
    shops.open()
    expect(await screen.findByText("manager page")).toBeInTheDocument()
  })

  it("sends a diner to the shop list once the shops say they have none", async () => {
    renderAt("/shop/s1", page, signedIn(ada))

    expect(await screen.findByText("shop list")).toBeInTheDocument()
  })

  it("shows the page when the shops can't be loaded, and lets the API decide", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => new HttpResponse(null, { status: 500 })))
    renderAt("/shop/s1", page, signedIn(ada))

    expect(await screen.findByText("manager page")).toBeInTheDocument()
  })

  it("shows the page to an administrator at once", () => {
    renderAt("/shop/s1", page, signedIn(root))

    expect(screen.getByText("manager page")).toBeInTheDocument()
  })
})

describe("an administrator's page", () => {
  const page = <AdminOnly><p>accounts page</p></AdminOnly>

  it("shows to an administrator", () => {
    renderAt("/admin/accounts", page, signedIn(root))
    expect(screen.getByText("accounts page")).toBeInTheDocument()
  })
  it("sends a shop manager home", async () => {
    renderAt("/admin/accounts", page, signedIn(sam))
    expect(await screen.findByText("shop list")).toBeInTheDocument()
  })
  it("sends a guest to sign in", async () => {
    renderAt("/admin/accounts", page, { user: { data: { ...ada, _id: "", role: "" }, status: "guest" } })
    expect(await screen.findByText("login page")).toBeInTheDocument()
  })
})

describe("the shell", () => {
  beforeEach(() => {
    quietShop()
    window.history.pushState({}, "", "/")
  })
  const renderApp = (user: IUser) => {
    server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json(user)))
    return render(
      <Provider store={makeStore(signedIn(user))}>
        <App />
      </Provider>
    )
  }

  it("gives a member of a shop the manager header and My Shops once the shops arrive", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])))
    const { container } = renderApp(ada)

    expect(await screen.findByRole("heading", { name: "My Shops" })).toBeInTheDocument()
    expect(container.querySelector(".App")).toHaveClass("is-manager")
    expect(screen.getByRole("link", { name: "My Shops" })).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Cafe" })).toHaveAttribute("href", "/shop/s1")
    // A member of someone else's shop doesn't create shops.
    expect(screen.queryByRole("button", { name: "Add Shop" })).not.toBeInTheDocument()
  })

  it("keeps the tab bar for a diner", async () => {
    const { container } = renderApp(ada)

    expect(await screen.findByRole("heading", { name: "Shops" })).toBeInTheDocument()
    expect(container.querySelector(".App")).not.toHaveClass("is-manager")
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
  })

  it("gives an administrator every shop, and Add Shop", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe, deli])))
    renderApp(root)

    expect(await screen.findByRole("link", { name: "Cafe" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Deli" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Shop" })).toBeInTheDocument()
    // The cards' glances have answered before the test ends, so no request outlives its handlers.
    await waitFor(() => expect(screen.getAllByText("Tables: all clear")).toHaveLength(2))
  })
})

describe("the account page's line", () => {
  it("says what the account is, from its role and its shops", () => {
    expect(roleLine(root, [])).toBe("Administrator")
    expect(roleLine(root, [cafe, deli])).toBe("Administrator")
    expect(roleLine(sam, [])).toBe("Shop manager")
    expect(roleLine(sam, [cafe])).toBe("Owner of Cafe")
    expect(roleLine(ada, [cafe])).toBe("Manager at Cafe")
    expect(roleLine(ada, [{ ...cafe, members: [{ userId: "u2", role: "owner", since }, { userId: "u1", role: "till", since, addedBy: "u2" }] }])).toBe("Till at Cafe")
    expect(roleLine(ada, [{ ...cafe, members: [{ userId: "u2", role: "owner", since }, { userId: "u1", role: "kitchen", since, addedBy: "u2" }] }, deli])).toBe("Staff at 2 shops")
    expect(roleLine(ada, [deli])).toBe("Owner of Deli")
    expect(roleLine(ada, [cafe, deli])).toBe("Manages 2 shops")
    expect(roleLine(ada, [])).toBeNull()
  })

  it("shows under the email", async () => {
    renderWithProviders(<Account />, { preloadedState: signedIn(ada, { data: [cafe], dataStatus: "ready" }) })

    expect(await screen.findByText("Manager at Cafe")).toBeInTheDocument()
  })
})

describe("an administrator's new shop", () => {
  let created: Record<string, unknown>[]
  let searches: string[]
  beforeEach(() => {
    created = []
    searches = []
    server.use(
      http.get(`${BASE}/users`, ({ request }) => {
        searches.push(new URL(request.url).search)
        return HttpResponse.json({ users: [{ ...sam, createdAt: since, updatedAt: since, shops: [] }, { ...root, createdAt: since, updatedAt: since, shops: [] }], total: 2, page: 1, limit: 5 })
      }),
      http.post(`${BASE}/shops`, async ({ request }) => {
        created.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json({ _id: "s9" }, { status: 201 })
      })
    )
  })
  const openEditor = (user: IUser) => renderWithProviders(<ShopModal show shopId="new" handleClose={() => {}} />, { preloadedState: signedIn(user) })

  it("names its owner, found by searching the accounts, administrators left out", async () => {
    const { user } = openEditor(root)

    await user.type(screen.getByLabelText("Owner (search by name or email)"), "sam")
    const matches = await screen.findByRole("list", { name: "Matching accounts" })
    expect(within(matches).getAllByRole("button")).toHaveLength(1)
    expect(searches.at(-1)).toBe("?q=sam&limit=10")
    await user.click(within(matches).getByRole("button", { name: /Sam Demo/ }))
    expect(screen.getByText("Sam Demo")).toBeInTheDocument()
    expect(screen.queryByLabelText("Owner (search by name or email)")).not.toBeInTheDocument()

    await user.type(screen.getByPlaceholderText("Name"), "Bakery")
    await user.click(screen.getByRole("button", { name: "Create Shop" }))
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).toMatchObject({ name: "Bakery", ownerId: "u2" })
  })

  it("asks for the owner before creating", async () => {
    const { user } = openEditor(root)

    await user.type(screen.getByPlaceholderText("Name"), "Bakery")
    await user.click(screen.getByRole("button", { name: "Create Shop" }))
    expect(await screen.findByText("Choose the shop's owner")).toBeInTheDocument()
    expect(created).toEqual([])
  })

  it("isn't asked of a shop manager, whose shop is their own", async () => {
    const { user } = openEditor(sam)

    expect(screen.queryByLabelText("Owner (search by name or email)")).not.toBeInTheDocument()
    await user.type(screen.getByPlaceholderText("Name"), "Bakery")
    await user.click(screen.getByRole("button", { name: "Create Shop" }))
    await waitFor(() => expect(created).toHaveLength(1))
    expect(created[0]).not.toHaveProperty("ownerId")
  })
})

describe("My Shops for a member", () => {
  it("has no Add Shop", async () => {
    quietShop()
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(ada)),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe]))
    )
    renderWithProviders(<Dashboard />, { preloadedState: signedIn(ada) })

    expect(await screen.findByRole("heading", { name: "My Shops" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Add Shop" })).not.toBeInTheDocument()
    expect(document.title).toBe("My Shops · UnQ")
  })
})
