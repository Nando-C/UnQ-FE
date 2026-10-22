import { describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { Route, Routes } from "react-router-dom"
import { http, HttpResponse } from "msw"
import StaffList from "../components/Shops/Staff/StaffList"
import { handOverMessage, mayMakeOwner, mayReRole, mayRemove, reRoleMessage, removeMessage, rolesFor } from "../lib/staff"
import { roleOnShop } from "../lib/roles"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { RootState } from "../redux/app/store"
import type { IShop, IStaffMember } from "../typings/shop"
import type { IUser } from "../typings/user"

// The Staff section of a shop's page: who belongs, what each of the owner, a
// manager and an administrator may do about them, and Add staff.

const ada: IUser = { _id: "u1", name: "Ada", surname: "L", email: "ada@example.com", avatar: "", role: "customer", hasPassword: true }
const sam: IUser = { ...ada, _id: "u2", name: "Sam", surname: "Demo", email: "sam@example.com", role: "shopMg" }
const root: IUser = { ...ada, _id: "u9", name: "Root", surname: "", email: "root@example.com", role: "admin" }
const since = "2026-10-01T09:00:00.000Z"
const cafe = {
  _id: "s1", name: "Cafe", cover: "", bio: "", open_times: "", phone: "", web_URL: "", timeZone: "Europe/London",
  shopMg: ["u2", "u1", "u3", "u6"], ownerId: "u2", menu: [], tables: [],
  members: [{ userId: "u2", role: "owner", since }, { userId: "u1", role: "manager", since, addedBy: "u2" }, { userId: "u3", role: "manager", since, addedBy: "u9" }, { userId: "u6", role: "till", since, addedBy: "u2" }],
} as IShop
const owner: IStaffMember = { userId: "u2", name: "Sam", surname: "Demo", email: "sam@example.com", avatar: "", role: "owner", since }
const adaRow: IStaffMember = { userId: "u1", name: "Ada", surname: "L", email: "ada@example.com", avatar: "", role: "manager", since: "2026-10-12T09:00:00.000Z", addedBy: "u2" }
const bob: IStaffMember = { userId: "u3", name: "Bob", surname: "K", email: "bob@example.com", avatar: "", role: "manager", since, addedBy: "u9" }
const kim: IStaffMember = { userId: "u6", name: "Kim", surname: "Demo", email: "kim@example.com", avatar: "", role: "till", since, addedBy: "u2" }
const staff = [owner, adaRow, bob, kim]

const state = (user: IUser): Partial<RootState> => ({
  user: { data: user, status: "authenticated" },
  shops: { data: [cafe], selected: cafe, selectedMenu: null, dataStatus: "ready" },
})

let members: IStaffMember[]
let requests: { method: string; path: string; body?: unknown }[]
beforeEach(() => {
  members = [...staff]
  requests = []
  server.use(
    http.get(`${BASE}/shops/s1/staff`, () => HttpResponse.json({ members })),
    http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])),
    http.delete(`${BASE}/shops/s1/staff/:userId`, ({ params }) => {
      requests.push({ method: "DELETE", path: `/shops/s1/staff/${params.userId}` })
      members = members.filter((m) => m.userId !== params.userId)
      return new HttpResponse(null, { status: 204 })
    }),
    http.put(`${BASE}/shops/s1/staff/:userId`, async ({ request, params }) => {
      const body = (await request.json()) as { role: IStaffMember["role"] }
      requests.push({ method: "PUT", path: `/shops/s1/staff/${params.userId}`, body })
      members = members.map((m) => (m.userId === params.userId ? { ...m, role: body.role } : m))
      return HttpResponse.json({ members })
    }),
    http.put(`${BASE}/shops/s1/owner`, async ({ request }) => {
      const body = (await request.json()) as { userId: string }
      requests.push({ method: "PUT", path: "/shops/s1/owner", body })
      // The owner first, as the API lists them.
      members = members
        .map((m): IStaffMember => ({ ...m, role: m.userId === body.userId ? "owner" : m.role === "owner" ? "manager" : m.role }))
        .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
      return HttpResponse.json({ members })
    })
  )
})

const renderStaff = (user: IUser) =>
  renderWithProviders(
    <Routes>
      <Route path="/shop/:shopId" element={<StaffList shopId="s1" />} />
      <Route path="/" element={<p>shop list</p>} />
    </Routes>,
    { route: "/shop/s1", preloadedState: state(user) }
  )
const dialog = () => screen.getByRole("dialog")

describe("the rules", () => {
  it("know who the caller is to the shop, and what they may do", () => {
    expect(roleOnShop(root, cafe)).toBe("admin")
    expect(roleOnShop(sam, cafe)).toBe("owner")
    expect(roleOnShop(ada, cafe)).toBe("manager")
    expect(mayRemove("owner", owner, "u2")).toBe(false)
    expect(mayRemove("owner", adaRow, "u2")).toBe(true)
    expect(mayRemove("manager", bob, "u1")).toBe(false)
    expect(mayRemove("manager", adaRow, "u1")).toBe(true)
    expect(mayRemove("admin", adaRow, "u9")).toBe(true)
    expect(mayRemove("owner", { ...adaRow, userId: null }, "u2")).toBe(false)
    expect(mayMakeOwner("owner", adaRow)).toBe(true)
    expect(mayMakeOwner("manager", bob)).toBe(false)
    expect(mayMakeOwner("admin", owner)).toBe(false)
    expect(mayMakeOwner("owner", { ...adaRow, userId: null })).toBe(false)
    // Changing a role: the owner anyone's but the owner's, a manager the three below's.
    expect(mayReRole("owner", adaRow)).toBe(true)
    expect(rolesFor("owner", adaRow)).toEqual(["till", "floor", "kitchen"])
    expect(mayReRole("owner", owner)).toBe(false)
    expect(mayReRole("manager", bob)).toBe(false)
    expect(mayReRole("manager", kim)).toBe(true)
    expect(rolesFor("manager", kim)).toEqual(["floor", "kitchen"])
    expect(mayReRole("till", kim)).toBe(false)
    expect(mayReRole("owner", { ...kim, userId: null })).toBe(false)
  })
  it("say what follows a change", () => {
    expect(removeMessage(adaRow, "Cafe", false)).toBe("Remove Ada from Cafe? They keep their account and lose access to this shop on their next request.")
    expect(removeMessage(adaRow, "Cafe", true)).toBe("Leave Cafe? You keep your account and lose access to this shop on your next request.")
    expect(handOverMessage(adaRow, "Cafe", "owner", owner)).toBe("Make Ada the owner of Cafe? You become a manager and can no longer delete the shop or remove managers.")
    expect(handOverMessage(adaRow, "Cafe", "admin", owner)).toBe("Make Ada the owner of Cafe? Sam becomes a manager.")
    expect(reRoleMessage(adaRow, "till", "Cafe")).toBe("Put Ada on the till at Cafe? The tables and the money: table sheets, cart fixes, refunds, payment checks, pay-backs. It takes effect on their next request.")
    expect(reRoleMessage(kim, "manager", "Cafe")).toMatch(/^Make Kim a manager at Cafe\? Runs the shop/)
  })
})

describe("the staff list", () => {
  it("lists each member with their role, since when and who added them, the owner first", async () => {
    renderStaff(sam)

    const rows = within(await screen.findByRole("list")).getAllByRole("listitem")
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent("Sam Demo (you)")
    expect(rows[0]).toHaveTextContent("sam@example.com · Owner · since 1 Oct 2026")
    expect(rows[1]).toHaveTextContent("ada@example.com · Manager · since 12 Oct 2026, added by Sam")
    // Added by an administrator, who isn't on the staff: nothing said.
    expect(rows[2]).toHaveTextContent("bob@example.com · Manager · since 1 Oct 2026")
    expect(rows[2]).not.toHaveTextContent("added by")
    expect(rows[3]).toHaveTextContent("kim@example.com · Till · since 1 Oct 2026, added by Sam")
    expect(screen.getByRole("button", { name: "Add staff" })).toBeInTheDocument()
  })

  it("names an account that is gone by what is left", async () => {
    members = [owner, { ...adaRow, userId: null, name: null, email: null, avatar: undefined }]
    renderStaff(sam)

    const rows = within(await screen.findByRole("list")).getAllByRole("listitem")
    expect(rows[1]).toHaveTextContent("An account that was deleted")
    expect(within(rows[1]).getByRole("button", { name: "Manage a deleted account" })).toBeInTheDocument()
  })

  it("has nothing to press on a deleted account's row, and says so", async () => {
    members = [owner, { ...adaRow, userId: null, name: null, email: null, avatar: undefined }]
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Manage a deleted account" }))

    const d = within(dialog())
    expect(d.getByText("This account was deleted; its row stays.")).toBeInTheDocument()
    expect(d.queryByRole("button", { name: /Remove|Make owner/ })).not.toBeInTheDocument()
  })

  it("says when it couldn't load, with a way to try again", async () => {
    let failures = 1
    server.use(http.get(`${BASE}/shops/s1/staff`, () => (failures-- > 0 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ members }))))
    const { user } = renderStaff(sam)

    expect(await screen.findByText("Couldn't load the staff.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Sam Demo")).toBeInTheDocument()
  })
})

describe("the owner", () => {
  it("removes a manager, after being told what follows", async () => {
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Manage Ada L" }))

    const d = within(dialog())
    expect(dialog().querySelector(".modal-title")).toHaveTextContent("Ada L")
    expect(d.getByText("Manager")).toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Remove" }))
    expect(d.getByText("Remove Ada from Cafe? They keep their account and lose access to this shop on their next request.")).toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Remove Ada" }))

    await waitFor(() => expect(requests).toEqual([{ method: "DELETE", path: "/shops/s1/staff/u1" }]))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText("Ada L")).not.toBeInTheDocument())
  })

  it("changes a member's role, after being told what follows, and the list follows", async () => {
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Manage Ada L" }))
    const d = within(dialog())
    expect(within(d.getByLabelText("Change role to")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Till", "Floor", "Kitchen"])
    await user.selectOptions(d.getByLabelText("Change role to"), "floor")
    await user.click(d.getByRole("button", { name: "Change role" }))
    expect(d.getByText(/Put Ada on the floor at Cafe\? The tables, no money/)).toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Change role" }))
    await waitFor(() => expect(requests).toEqual([{ method: "PUT", path: "/shops/s1/staff/u1", body: { role: "floor" } }]))
    const rows = within(await screen.findByRole("list")).getAllByRole("listitem")
    await waitFor(() => expect(rows[1]).toHaveTextContent("Floor"))
  })

  it("hands the shop over to a manager", async () => {
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Manage Ada L" }))

    const d = within(dialog())
    await user.click(d.getByRole("button", { name: "Make owner" }))
    expect(d.getByText("Make Ada the owner of Cafe? You become a manager and can no longer delete the shop or remove managers.")).toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Make owner" }))

    await waitFor(() => expect(requests).toEqual([{ method: "PUT", path: "/shops/s1/owner", body: { userId: "u1" } }]))
    // The list is the API's answer again: the new owner first.
    await waitFor(() => {
      const rows = within(screen.getByRole("list")).getAllByRole("listitem")
      expect(rows[0]).toHaveTextContent("Ada L")
      expect(rows[0]).toHaveTextContent("Owner")
      expect(rows[1]).toHaveTextContent("Sam Demo (you)")
      expect(rows[1]).toHaveTextContent("Manager")
    })
  })

  it("can't be removed, and is told why", async () => {
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Manage Sam Demo" }))

    const d = within(dialog())
    expect(dialog().querySelector(".modal-title")).toHaveTextContent("You")
    expect(d.getByText("The owner can't be removed: the shop is handed over first.")).toBeInTheDocument()
    expect(d.queryByRole("button", { name: /Remove|Leave/ })).not.toBeInTheDocument()
    expect(d.queryByRole("button", { name: "Make owner" })).not.toBeInTheDocument()
  })

  it("shows the API's refusal and reloads the list", async () => {
    let loads = 0
    server.use(
      http.get(`${BASE}/shops/s1/staff`, () => {
        loads++
        return HttpResponse.json({ members })
      }),
      http.delete(`${BASE}/shops/s1/staff/u1`, () => HttpResponse.json({ message: "The shop's staff changed, please retry" }, { status: 409 }))
    )
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Manage Ada L" }))
    const d = within(dialog())
    await user.click(d.getByRole("button", { name: "Remove" }))
    await user.click(d.getByRole("button", { name: "Remove Ada" }))

    expect(await d.findByText("The shop's staff changed, please retry")).toBeInTheDocument()
    expect(d.getByRole("button", { name: "Remove" })).toBeInTheDocument()
    await waitFor(() => expect(loads).toBe(2))
  })

  it("keeps the dialog, and its error, when the reload finds the member gone", async () => {
    server.use(
      http.get(`${BASE}/shops/s1/staff`, () => HttpResponse.json({ members })),
      http.delete(`${BASE}/shops/s1/staff/u1`, () => {
        members = members.filter((m) => m.userId !== "u1")
        return HttpResponse.json({ message: "Not a member of this shop" }, { status: 404 })
      })
    )
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Manage Ada L" }))
    const d = within(dialog())
    await user.click(d.getByRole("button", { name: "Remove" }))
    await user.click(d.getByRole("button", { name: "Remove Ada" }))

    expect(await d.findByText("Not a member of this shop")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("button", { name: "Manage Ada L" })).not.toBeInTheDocument())
    expect(dialog().querySelector(".modal-title")).toHaveTextContent("Ada L")
  })
})

describe("a manager", () => {
  it("adds the three roles below manager, may leave, and can't touch another manager", async () => {
    const { user } = renderStaff(ada)

    expect(await screen.findByText("Sam Demo")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Add staff" }))
    const add = within(dialog())
    expect(within(add.getByLabelText("Role")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Till", "Floor", "Kitchen"])
    await user.click(add.getByRole("button", { name: "Close" }))
    await user.click(screen.getByRole("button", { name: "Manage Bob K" }))
    let d = within(dialog())
    expect(d.getByText("Only the owner removes a manager.")).toBeInTheDocument()
    expect(d.queryByRole("button", { name: /Remove|Make owner/ })).not.toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Close" }))

    await user.click(screen.getByRole("button", { name: "Manage Ada L" }))
    d = within(dialog())
    await user.click(d.getByRole("button", { name: "Leave shop" }))
    expect(d.getByText("Leave Cafe? You keep your account and lose access to this shop on your next request.")).toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Leave shop" }))
    await waitFor(() => expect(requests).toEqual([{ method: "DELETE", path: "/shops/s1/staff/u1" }]))
    // Having left, back to the shop list.
    expect(await screen.findByText("shop list")).toBeInTheDocument()
  })
})

describe("an administrator", () => {
  it("has Add staff and the owner's actions, and is told who becomes a manager", async () => {
    const { user } = renderStaff(root)

    expect(await screen.findByRole("button", { name: "Add staff" })).toBeInTheDocument()
    // The header shows before the list has loaded.
    await user.click(await screen.findByRole("button", { name: "Manage Ada L" }))
    const d = within(dialog())
    expect(d.getByRole("button", { name: "Remove" })).toBeInTheDocument()
    await user.click(d.getByRole("button", { name: "Make owner" }))
    expect(d.getByText("Make Ada the owner of Cafe? Sam becomes a manager.")).toBeInTheDocument()
  })
})

describe("Add staff", () => {
  let posted: Record<string, unknown>[]
  beforeEach(() => {
    posted = []
  })
  const answer = (created: boolean) =>
    server.use(
      http.post(`${BASE}/shops/s1/staff`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        posted.push(body)
        const member: IStaffMember = { userId: "u4", name: (body.name as string) ?? "Alex", surname: "", email: body.email as string, avatar: "", role: body.role as IStaffMember["role"], since, addedBy: "u2" }
        members = [...members, member]
        return HttpResponse.json({ member, created }, { status: created ? 201 : 200 })
      })
    )

  it("creates an account for a new address, from the fields that appear once it is typed", async () => {
    answer(true)
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Add staff" }))

    const d = within(dialog())
    expect(d.queryByLabelText("Name")).not.toBeInTheDocument()
    await user.type(d.getByLabelText("Email"), "alex@example.com")
    await user.type(d.getByLabelText("Name"), "Alex")
    await user.type(d.getByLabelText("Surname"), "Demo")
    await user.type(d.getByLabelText("First password"), "secret-pass")
    await user.click(d.getByRole("button", { name: "Add to staff" }))

    await waitFor(() => expect(posted).toEqual([{ email: "alex@example.com", role: "manager", name: "Alex", surname: "Demo", password: "secret-pass" }]))
    expect(await screen.findByText("Account created for Alex. Give them the password you set; they can change it on their account page.")).toBeInTheDocument()
    expect(await screen.findByText("Alex")).toBeInTheDocument()
  })

  it("attaches an existing account, sending only the email", async () => {
    answer(false)
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Add staff" }))
    const d = within(dialog())
    await user.type(d.getByLabelText("Email"), "alex@example.com")
    await user.click(d.getByRole("button", { name: "Add to staff" }))

    await waitFor(() => expect(posted).toEqual([{ email: "alex@example.com", role: "manager" }]))
    expect(await screen.findByText("Alex already had an account and is now a manager at Cafe.")).toBeInTheDocument()
  })

  it("offers the owner four roles and a manager three, each with a line on what it does, and sends the one picked", async () => {
    answer(false)
    const { user } = renderStaff(ada)
    await user.click(await screen.findByRole("button", { name: "Add staff" }))
    const d = within(dialog())
    await user.selectOptions(d.getByLabelText("Role"), "kitchen")
    expect(d.getByText("Reads the tables and their orders; says when a dish has run out.")).toBeInTheDocument()
    await user.type(d.getByLabelText("Email"), "alex@example.com")
    await user.click(d.getByRole("button", { name: "Add to staff" }))
    await waitFor(() => expect(posted).toEqual([{ email: "alex@example.com", role: "kitchen" }]))
    expect(await screen.findByText("Alex already had an account and is now in the kitchen at Cafe.")).toBeInTheDocument()
  })

  it("shows what the API refused", async () => {
    server.use(
      http.post(`${BASE}/shops/s1/staff`, () =>
        HttpResponse.json({ message: "Validation failed", details: [{ path: "name", message: "Required for a new account" }] }, { status: 400 })
      )
    )
    const { user } = renderStaff(sam)
    await user.click(await screen.findByRole("button", { name: "Add staff" }))
    const d = within(dialog())
    await user.click(d.getByRole("button", { name: "Add to staff" }))
    expect(await d.findByText("Email is required")).toBeInTheDocument()
    await user.type(d.getByLabelText("Email"), "new@example.com")
    await user.click(d.getByRole("button", { name: "Add to staff" }))
    expect(await d.findByText("Required for a new account")).toBeInTheDocument()
  })
})
