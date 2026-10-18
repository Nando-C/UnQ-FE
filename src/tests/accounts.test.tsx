import { describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import Accounts from "../components/Admin/Accounts/Accounts"
import ShopNavbar from "../components/Shops/ShopNavbar/ShopNavbar"
import { deleteAccountMessage, shopsLine } from "../lib/accounts"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { RootState } from "../redux/app/store"
import type { IListedUser, IUser } from "../typings/user"

// The administrator's Accounts page: the search, each account's row and
// dialog (role, delete), New account, and the header's way there.

const root: IUser = { _id: "u9", name: "Root", surname: "", email: "root@example.com", avatar: "", role: "admin", hasPassword: true }
const at = "2026-10-01T09:00:00.000Z"
const listed = (over: Partial<IListedUser>): IListedUser => ({
  _id: "u0", name: "Who", surname: "", email: "who@example.com", avatar: "", role: "customer", hasPassword: true, createdAt: at, updatedAt: at, shops: [], ...over,
})
const sam = listed({ _id: "u2", name: "Sam", surname: "Demo", email: "sam@example.com", role: "shopMg", shops: [{ _id: "s1", name: "Cafe", role: "owner" }, { _id: "s2", name: "Deli", role: "manager" }] })
const ada = listed({ _id: "u1", name: "Ada", surname: "L", email: "ada@example.com", hasPassword: false, shops: [{ _id: "s1", name: "Cafe", role: "manager" }], createdAt: "2026-10-12T09:00:00.000Z" })
const me = listed({ ...root, surname: "Admin" })

const state: Partial<RootState> = { user: { data: root, status: "authenticated" } }
let accounts: IListedUser[]
let searches: string[]
let changes: { method: string; path: string; body?: unknown }[]
beforeEach(() => {
  // Copies: the role handler below changes the account it is asked about.
  accounts = [sam, ada, me].map((a) => ({ ...a }))
  searches = []
  changes = []
  server.use(
    http.get(`${BASE}/users`, ({ request }) => {
      const url = new URL(request.url)
      searches.push(url.search)
      const q = (url.searchParams.get("q") ?? "").toLowerCase()
      const role = url.searchParams.get("role")
      const page = Number(url.searchParams.get("page") ?? 1)
      const limit = Number(url.searchParams.get("limit") ?? 20)
      const hits = accounts.filter((a) => (!q || `${a.name} ${a.surname} ${a.email}`.toLowerCase().includes(q)) && (!role || a.role === role))
      return HttpResponse.json({ users: hits.slice((page - 1) * limit, page * limit), total: hits.length, page, limit })
    }),
    http.put(`${BASE}/users/:userId/role`, async ({ request, params }) => {
      const body = (await request.json()) as { role: string }
      changes.push({ method: "PUT", path: `/users/${params.userId}/role`, body })
      const account = accounts.find((a) => a._id === params.userId)!
      account.role = body.role
      return HttpResponse.json(account)
    }),
    http.delete(`${BASE}/users/:userId`, ({ params }) => {
      changes.push({ method: "DELETE", path: `/users/${params.userId}` })
      accounts = accounts.filter((a) => a._id !== params.userId)
      return new HttpResponse(null, { status: 204 })
    })
  )
})
const renderPage = () => renderWithProviders(<Accounts />, { route: "/admin/accounts", preloadedState: state })
const dialog = () => screen.getByRole("dialog")

describe("the wording", () => {
  it("lists the shops an account works at", () => {
    expect(shopsLine([])).toBe("no shops")
    expect(shopsLine(sam.shops)).toBe("Owner of Cafe, manager at Deli")
    expect(shopsLine(ada.shops)).toBe("Manager at Cafe")
  })
  it("says what deleting does, and what the API will refuse", () => {
    expect(deleteAccountMessage(ada)).toBe("Delete Ada's account? Their sign-ins end and they leave the shops they work at.")
    expect(deleteAccountMessage(sam)).toBe("Delete Sam's account? Their sign-ins end and they leave the shops they work at. They own Cafe: hand it over or delete it first.")
  })
})

describe("the accounts list", () => {
  it("lists every account with its role, shops and since when, and searches as typed", async () => {
    const { user } = renderPage()

    expect(await screen.findByText("3 accounts")).toBeInTheDocument()
    const rows = within(screen.getByRole("list")).getAllByRole("listitem")
    expect(rows[0]).toHaveTextContent("Sam Demo")
    expect(rows[0]).toHaveTextContent("sam@example.com · Shop manager · Owner of Cafe, manager at Deli · since 1 Oct 2026")
    expect(rows[1]).toHaveTextContent("ada@example.com · Customer · Manager at Cafe · since 12 Oct 2026")
    expect(rows[2]).toHaveTextContent("Root Admin (you)")
    expect(document.title).toBe("Accounts · UnQ")
    expect(searches).toEqual(["?page=1&limit=20"])

    await user.type(screen.getByLabelText("Search by name or email"), "ada")
    // The rows stay while the search is on its way.
    expect(screen.getByText("Sam Demo")).toBeInTheDocument()
    expect(await screen.findByText("1 account", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByText("Sam Demo")).not.toBeInTheDocument()
    expect(searches.at(-1)).toBe("?q=ada&page=1&limit=20")

    await user.selectOptions(screen.getByLabelText("Role"), "admin")
    expect(await screen.findByText("No account matches.", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(searches.at(-1)).toBe("?q=ada&role=admin&page=1&limit=20")
  })

  it("shows a good list over a stale search's failure", async () => {
    // "ada" fails late, after "ada l" has answered.
    server.use(
      http.get(`${BASE}/users`, async ({ request }) => {
        const q = new URL(request.url).searchParams.get("q")
        if (q === "ada") {
          await new Promise((r) => setTimeout(r, 400))
          return new HttpResponse(null, { status: 500 })
        }
        return HttpResponse.json({ users: q ? [ada] : accounts, total: q ? 1 : 3, page: 1, limit: 20 })
      })
    )
    const { user } = renderPage()
    expect(await screen.findByText("3 accounts")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Search by name or email"), "ada")
    await new Promise((r) => setTimeout(r, 320))
    await user.type(screen.getByLabelText("Search by name or email"), " l")

    expect(await screen.findByText("1 account", {}, { timeout: 3000 })).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 500))
    expect(screen.queryByText("Couldn't load the accounts.")).not.toBeInTheDocument()
    expect(screen.getByText("1 account")).toBeInTheDocument()
  })

  it("shows more, a page at a time", async () => {
    accounts = Array.from({ length: 25 }, (_, i) => listed({ _id: `a${i}`, name: `Person ${i}`, email: `p${i}@example.com` }))
    const { user } = renderPage()

    expect(await screen.findByText("25 accounts")).toBeInTheDocument()
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(20)
    await user.click(screen.getByRole("button", { name: "Show more" }))
    await waitFor(() => expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(25))
    expect(searches.at(-1)).toBe("?page=2&limit=20")
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument()
  })

  it("says when it couldn't load, with a way to try again", async () => {
    let failures = 1
    server.use(http.get(`${BASE}/users`, () => (failures-- > 0 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ users: accounts, total: 3, page: 1, limit: 20 }))))
    const { user } = renderPage()

    expect(await screen.findByText("Couldn't load the accounts.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("3 accounts")).toBeInTheDocument()
  })
})

describe("an account's dialog", () => {
  it("shows the account and saves the role as picked", async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole("button", { name: "Manage Ada L" }))

    const d = within(dialog())
    expect(dialog().querySelector(".modal-title")).toHaveTextContent("Ada L")
    expect(d.getByText("Manager at Cafe")).toBeInTheDocument()
    expect(d.getByText("with Google only")).toBeInTheDocument()
    await user.selectOptions(d.getByLabelText("Role"), "shopMg")

    await waitFor(() => expect(changes).toEqual([{ method: "PUT", path: "/users/u1/role", body: { role: "shopMg" } }]))
    expect(d.getByLabelText("Role")).toHaveValue("shopMg")
    await user.click(d.getByRole("button", { name: "Done" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(within(screen.getByRole("list")).getAllByRole("listitem")[1]).toHaveTextContent("Shop manager")
  })

  it("shows the API's refusal of a role", async () => {
    server.use(http.put(`${BASE}/users/u1/role`, () => HttpResponse.json({ message: "Hand over or leave their shops first" }, { status: 409 })))
    const { user } = renderPage()
    await user.click(await screen.findByRole("button", { name: "Manage Ada L" }))
    const d = within(dialog())
    await user.selectOptions(d.getByLabelText("Role"), "admin")

    expect(await d.findByText("Hand over or leave their shops first")).toBeInTheDocument()
    expect(d.getByLabelText("Role")).toHaveValue("customer")
  })

  it("deletes an account after saying what follows, and tells of a shop owned", async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole("button", { name: "Manage Sam Demo" }))
    let d = within(dialog())
    await user.click(d.getByRole("button", { name: "Delete account" }))
    expect(d.getByText("Delete Sam's account? Their sign-ins end and they leave the shops they work at. They own Cafe: hand it over or delete it first.")).toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Cancel" }))
    await user.click(d.getByRole("button", { name: "Done" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    await user.click(screen.getByRole("button", { name: "Manage Ada L" }))
    d = within(dialog())
    await user.click(d.getByRole("button", { name: "Delete account" }))
    expect(d.getByText("Delete Ada's account? Their sign-ins end and they leave the shops they work at.")).toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Delete account" }))

    await waitFor(() => expect(changes).toEqual([{ method: "DELETE", path: "/users/u1" }]))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.queryByText("Ada L")).not.toBeInTheDocument()
    expect(screen.getByText("2 accounts")).toBeInTheDocument()
  })

  it("offers neither on the administrator's own account", async () => {
    const { user } = renderPage()
    await user.click(await screen.findByRole("button", { name: "Manage Root Admin" }))

    const d = within(dialog())
    expect(dialog().querySelector(".modal-title")).toHaveTextContent("You")
    expect(d.getByLabelText("Role")).toBeDisabled()
    expect(d.getByText("You can't change your own role.")).toBeInTheDocument()
    expect(d.getByText("Another administrator deletes your account.")).toBeInTheDocument()
    expect(d.queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument()
  })
})

describe("New account", () => {
  it("creates one with a role, and says so", async () => {
    const posted: unknown[] = []
    server.use(
      http.post(`${BASE}/users`, async ({ request }) => {
        const body = (await request.json()) as Record<string, string>
        posted.push(body)
        accounts = [listed({ _id: "u4", name: body.name, surname: body.surname, email: body.email, role: body.role }), ...accounts]
        return HttpResponse.json(accounts[0], { status: 201 })
      })
    )
    const { user } = renderPage()
    expect(await screen.findByText("3 accounts")).toBeInTheDocument()
    // Created while searching: the search is cleared, so the new account shows.
    await user.type(screen.getByLabelText("Search by name or email"), "sam")
    expect(await screen.findByText("1 account", {}, { timeout: 3000 })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "New account" }))

    const d = within(dialog())
    await user.type(d.getByLabelText("Name"), "Alex")
    await user.type(d.getByLabelText("Surname"), "Demo")
    await user.type(d.getByLabelText("Email"), "alex@example.com")
    await user.type(d.getByLabelText("First password"), "secret-pass")
    await user.selectOptions(d.getByLabelText("Role"), "shopMg")
    await user.click(d.getByRole("button", { name: "Create account" }))

    await waitFor(() => expect(posted).toEqual([{ name: "Alex", surname: "Demo", email: "alex@example.com", password: "secret-pass", role: "shopMg" }]))
    expect(await screen.findByText("Account created for Alex. Give them the password you set; they can change it on their account page.")).toBeInTheDocument()
    expect(await screen.findByText("4 accounts", {}, { timeout: 3000 })).toBeInTheDocument()
    expect(within(screen.getByRole("list")).getAllByRole("listitem")[0]).toHaveTextContent("Alex Demo")
    expect(screen.getByLabelText("Search by name or email")).toHaveValue("")
  })

  it("asks for every field, and a password of eight characters, before sending", async () => {
    const posted: unknown[] = []
    server.use(http.post(`${BASE}/users`, () => { posted.push(1); return HttpResponse.json({}, { status: 201 }) }))
    const { user } = renderPage()
    await user.click(await screen.findByRole("button", { name: "New account" }))
    const d = within(dialog())
    await user.type(d.getByLabelText("Name"), "Alex")
    await user.click(d.getByRole("button", { name: "Create account" }))
    expect(await d.findByText("All fields are required")).toBeInTheDocument()
    await user.type(d.getByLabelText("Surname"), "Demo")
    await user.type(d.getByLabelText("Email"), "alex@example.com")
    await user.type(d.getByLabelText("First password"), "short")
    await user.click(d.getByRole("button", { name: "Create account" }))
    expect(await d.findByText("The password needs at least 8 characters")).toBeInTheDocument()
    expect(posted).toEqual([])
  })

  it("shows what the API refused", async () => {
    server.use(http.post(`${BASE}/users`, () => HttpResponse.json({ message: "Email already registered" }, { status: 409 })))
    const { user } = renderPage()
    await user.click(await screen.findByRole("button", { name: "New account" }))
    const d = within(dialog())
    await user.type(d.getByLabelText("Name"), "Alex")
    await user.type(d.getByLabelText("Surname"), "Demo")
    await user.type(d.getByLabelText("Email"), "alex@example.com")
    await user.type(d.getByLabelText("First password"), "secret-pass")
    await user.click(d.getByRole("button", { name: "Create account" }))
    expect(await d.findByText("Email already registered")).toBeInTheDocument()
  })
})

describe("the header", () => {
  it("shows Accounts to an administrator only", () => {
    const { unmount } = renderWithProviders(<ShopNavbar />, { preloadedState: state })
    expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute("href", "/admin/accounts")
    unmount()
    renderWithProviders(<ShopNavbar />, { preloadedState: { user: { data: { ...root, role: "shopMg" }, status: "authenticated" } } })
    expect(screen.queryByRole("link", { name: "Accounts" })).not.toBeInTheDocument()
  })
})
