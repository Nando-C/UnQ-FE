import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { Provider } from "react-redux"
import { http, HttpResponse } from "msw"
import App from "../App"
import Account from "../components/Customers/Account/Account"
import { isDinerPage, rememberShell, rememberedStaffShell } from "../lib/shell"
import { logOut } from "../redux/slices/userSlice"
import { gate, makeStore, renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import { range, totals } from "./salesFixtures"
import type { RootState } from "../redux/app/store"
import type { IShop } from "../typings/shop"
import type { IUser } from "../typings/user"

// The shell is the manager header for whoever runs a shop and the bottom tab
// bar for everyone else, with two refinements: a table's menu and cart are
// the diner's pages for everybody, and on a reloaded page the shell drawn
// last time stands in until the account and its shops have answered, so the
// page doesn't swap one for the other under the reader.

const ada: IUser = { _id: "u1", name: "Ada", surname: "L", email: "ada@example.com", avatar: "", role: "customer", hasPassword: true }
const sam: IUser = { ...ada, _id: "u2", name: "Sam", surname: "Demo", email: "sam@example.com", role: "shopMg" }
const since = "2026-10-01T09:00:00.000Z"
// Sam's café, where Ada works the till.
const cafe = {
  _id: "s1", name: "Cafe", cover: "", bio: "", open_times: "", phone: "", web_URL: "", timeZone: "Europe/London",
  shopMg: ["u2", "u1"], ownerId: "u2",
  members: [{ userId: "u2", role: "owner", since }, { userId: "u1", role: "till", since, addedBy: "u2" }],
  menu: [], tables: [{ _id: "t1", name: "1", seats: 2, Qr_Url: "" }],
} as unknown as IShop

const signedIn = (user: IUser): Partial<RootState> => ({ user: { data: user, status: "authenticated" } })

const renderApp = (user: IUser | null, path: string, preloadedState?: Partial<RootState>) => {
  server.use(http.get(`${BASE}/users/me`, () => (user ? HttpResponse.json(user) : new HttpResponse(null, { status: 401 }))))
  window.history.pushState({}, "", path)
  const store = makeStore(preloadedState)
  return { store, ...render(<Provider store={store}><App /></Provider>) }
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  server.use(
    http.get(`${BASE}/shops/s1`, () => HttpResponse.json(cafe)),
    http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json({ _id: "c1", userId: "u1", tableId: "t1", status: "open", items: [] })),
    http.get(`${BASE}/shops/:shopId/tables/status`, () => HttpResponse.json([])),
    http.get(`${BASE}/shops/:shopId/sales`, () => HttpResponse.json({ range: range("2026-01-01", "2026-01-07", 7), totals: totals(), series: [], heatmap: [], items: [], refunds: { count: 0, byReason: [], byHour: [] }, tables: [] }))
  )
})

describe("the diner's pages", () => {
  it("are a table's menu and cart, and a shop's menu before a table is picked", () => {
    expect(isDinerPage("/shops/s1/tables/t1")).toBe(true)
    expect(isDinerPage("/shops/s1/tables/t1/cart")).toBe(true)
    expect(isDinerPage("/customer/shop/s1")).toBe(true)
    expect(isDinerPage("/")).toBe(false)
    expect(isDinerPage("/shop/s1")).toBe(false)
    expect(isDinerPage("/shop/s1/sales")).toBe(false)
    expect(isDinerPage("/myAccount")).toBe(false)
    expect(isDinerPage("/admin/accounts")).toBe(false)
    // Only the pages themselves: an address under one that leads nowhere isn't.
    expect(isDinerPage("/shops/s1/tables/t1/cart/receipt")).toBe(false)
    expect(isDinerPage("/shops/s1/tables")).toBe(false)
  })

  it("give a shop manager the tab bar on a table's cart, with nothing over the Back link", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])))
    const { container } = renderApp(sam, "/shops/s1/tables/t1/cart", signedIn(sam))

    expect(await screen.findByRole("button", { name: "Back" })).toBeInTheDocument()
    expect(container.querySelector(".App")).not.toHaveClass("is-manager")
    expect(container.querySelector(".ShopHeader")).not.toBeInTheDocument()
    // The way to the cart, and the way home.
    expect(await screen.findByRole("link", { name: /^Cart/ })).toHaveAttribute("href", "/shops/s1/tables/t1/cart")
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
  })

  it("give a member of a shop the tab bar on a table's menu, once their shops have said who they are", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])))
    const { container, store } = renderApp(ada, "/shops/s1/tables/t1", signedIn(ada))

    await waitFor(() => expect(store.getState().shops.dataStatus).toBe("ready"))
    expect(container.querySelector(".App")).not.toHaveClass("is-manager")
    expect(container.querySelector(".ShopHeader")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
  })

  it("leave the manager header on the manager's own pages", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])))
    const { container } = renderApp(sam, "/", signedIn(sam))

    expect(await screen.findByRole("heading", { name: "My Shops" })).toBeInTheDocument()
    expect(container.querySelector(".App")).toHaveClass("is-manager")
    expect(container.querySelector(".ShopHeader")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("Tables: all clear")).toBeInTheDocument())
  })
})

describe("the shell on a reloaded page", () => {
  it("is the one drawn last time, while the account is still being asked for", async () => {
    rememberShell(true)
    const held = gate()
    server.use(
      http.get(`${BASE}/users/me`, async () => { await held.opened; return HttpResponse.json(ada) }),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe]))
    )
    window.history.pushState({}, "", "/")
    const { container } = render(<Provider store={makeStore()}><App /></Provider>)

    // Nothing has answered yet: the header, and My Shops, not the diner's list.
    expect(container.querySelector(".App")).toHaveClass("is-manager")
    expect(container.querySelector(".ShopHeader")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "My Shops" })).toBeInTheDocument()

    held.open()
    expect(await screen.findByRole("link", { name: "Cafe" })).toBeInTheDocument()
    expect(container.querySelector(".App")).toHaveClass("is-manager")
    await waitFor(() => expect(screen.getByText("Tables: all clear")).toBeInTheDocument())
  })

  it("stays the header for a member while their shops are on the way", async () => {
    rememberShell(true)
    const held = gate()
    server.use(http.get(`${BASE}/shops/me`, async () => { await held.opened; return HttpResponse.json([cafe]) }))
    const { container, store } = renderApp(ada, "/myAccount", signedIn(ada))

    await waitFor(() => expect(store.getState().shops.dataStatus).toBe("loading"))
    expect(container.querySelector(".App")).toHaveClass("is-manager")
    held.open()
    expect(await screen.findByText("Till at Cafe")).toBeInTheDocument()
    expect(container.querySelector(".App")).toHaveClass("is-manager")
  })

  it("is the tab bar for an account never seen running a shop, until its shops say otherwise", async () => {
    const held = gate()
    server.use(http.get(`${BASE}/shops/me`, async () => { await held.opened; return HttpResponse.json([cafe]) }))
    const { container, store } = renderApp(ada, "/myAccount", signedIn(ada))

    await waitFor(() => expect(store.getState().shops.dataStatus).toBe("loading"))
    expect(container.querySelector(".App")).not.toHaveClass("is-manager")
    held.open()
    await waitFor(() => expect(container.querySelector(".App")).toHaveClass("is-manager"))
  })

  it("is corrected when the answer differs: a remembered header gives way to the tab bar for a diner", async () => {
    rememberShell(true)
    const { container, store } = renderApp(ada, "/", signedIn(ada))

    await waitFor(() => expect(store.getState().shops.dataStatus).toBe("ready"))
    expect(container.querySelector(".App")).not.toHaveClass("is-manager")
    expect(await screen.findByRole("heading", { name: "Shops" })).toBeInTheDocument()
    expect(rememberedStaffShell()).toBe(false)
  })
})

describe("the shell once the account is known", () => {
  it("stays put while the account is asked for again, with nothing remembered", async () => {
    // The home page asks "who am I" each time it opens; the account in hand
    // still says who runs shops.
    const held = gate()
    server.use(
      http.get(`${BASE}/users/me`, async () => { await held.opened; return HttpResponse.json(sam) }),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe]))
    )
    window.history.pushState({}, "", "/")
    const store = makeStore(signedIn(sam))
    const { container } = render(<Provider store={store}><App /></Provider>)

    await waitFor(() => expect(store.getState().user.status).toBe("loading"))
    localStorage.clear()
    expect(container.querySelector(".App")).toHaveClass("is-manager")
    expect(screen.getByRole("heading", { name: "My Shops" })).toBeInTheDocument()
    held.open()
    await waitFor(() => expect(screen.getByText("Tables: all clear")).toBeInTheDocument())
  })

  it("is the tab bar when a member's shops can't be loaded, whatever was remembered", async () => {
    rememberShell(true)
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 })))
    const { container, store } = renderApp(ada, "/myAccount", signedIn(ada))

    await waitFor(() => expect(store.getState().shops.dataStatus).toBe("failed"))
    expect(container.querySelector(".App")).not.toHaveClass("is-manager")
    // A failure says nothing lasting: the next load starts as the last one did.
    expect(rememberedStaffShell()).toBe(true)
  })
})

describe("what is remembered", () => {
  it("survives a load on which the API couldn't be reached", async () => {
    rememberShell(true)
    server.use(http.get(`${BASE}/users/me`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 })))
    window.history.pushState({}, "", "/")
    const store = makeStore()
    render(<Provider store={store}><App /></Provider>)

    await waitFor(() => expect(store.getState().user.status).toBe("guest"))
    expect(rememberedStaffShell()).toBe(true)
  })

  it("is forgotten when the API says the session has ended", async () => {
    rememberShell(true)
    window.history.pushState({}, "", "/")
    const store = makeStore()
    render(<Provider store={store}><App /></Provider>)

    await waitFor(() => expect(store.getState().user.status).toBe("guest"))
    await waitFor(() => expect(rememberedStaffShell()).toBe(false))
  })

  it("is that the account runs a shop, once its shops have said so", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])))
    renderApp(ada, "/myAccount", signedIn(ada))

    await waitFor(() => expect(rememberedStaffShell()).toBe(true))
    // A word about the layout, nothing about the account.
    expect(localStorage.getItem("unq.shell")).toBe("staff")
    expect(localStorage.length).toBe(1)
  })

  it("is kept on a diner's page, where the tab bar shows", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])))
    renderApp(sam, "/shops/s1/tables/t1/cart", signedIn(sam))

    await waitFor(() => expect(rememberedStaffShell()).toBe(true))
  })

  it("is forgotten when the account signs out", async () => {
    rememberShell(true)
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])))
    const { store } = renderApp(sam, "/", signedIn(sam))
    await waitFor(() => expect(screen.getByText("Tables: all clear")).toBeInTheDocument())

    store.dispatch(logOut.fulfilled(undefined, "r"))
    await waitFor(() => expect(rememberedStaffShell()).toBe(false))
  })

  it("is nothing where the browser keeps nothing", () => {
    const original = Storage.prototype.getItem
    Storage.prototype.getItem = () => { throw new Error("blocked") }
    try {
      expect(rememberedStaffShell()).toBe(false)
    } finally {
      Storage.prototype.getItem = original
    }
  })
})

describe("the account page while it loads", () => {
  it("holds the place of the role line for whoever runs a shop", async () => {
    const held = gate()
    server.use(http.get(`${BASE}/shops/me`, async () => { await held.opened; return HttpResponse.json([cafe]) }))
    const { container } = renderWithProviders(<Account />, {
      preloadedState: { ...signedIn(sam), shops: { data: [], selected: null, selectedMenu: null, dataStatus: "loading" } },
    })

    expect(container.querySelector(".card-body .placeholder")).toBeInTheDocument()
    expect(screen.queryByText("Shop manager")).not.toBeInTheDocument()
  })

  it("holds none for a diner, who has no line", () => {
    const { container } = renderWithProviders(<Account />, {
      preloadedState: { ...signedIn(ada), shops: { data: [], selected: null, selectedMenu: null, dataStatus: "loading" } },
    })

    expect(container.querySelector(".card-body .placeholder")).not.toBeInTheDocument()
  })

  it("shows one device's row in outline until the devices answer", async () => {
    const held = gate()
    server.use(
      http.get(`${BASE}/auth/sessions`, async () => {
        await held.opened
        return HttpResponse.json([{ _id: "d1", userAgent: "Mozilla/5.0 (Macintosh) Chrome/140", createdAt: since, lastUsedAt: since, current: true }])
      })
    )
    const { container } = renderWithProviders(<Account />, {
      preloadedState: { ...signedIn(ada), shops: { data: [], selected: null, selectedMenu: null, dataStatus: "ready" } },
    })

    expect(screen.getByText("Loading devices")).toBeInTheDocument()
    expect(container.querySelectorAll(".Devices .list-group-item")).toHaveLength(1)
    expect(container.querySelector(".Devices .list-group-item .placeholder")).toBeInTheDocument()

    held.open()
    expect(await screen.findByText("This device")).toBeInTheDocument()
    expect(screen.queryByText("Loading devices")).not.toBeInTheDocument()
    expect(container.querySelector(".Devices .placeholder")).not.toBeInTheDocument()
  })
})
