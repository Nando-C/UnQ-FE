import { describe, it, expect, beforeEach, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import ShopDetails from "../components/Shops/ShopDetails/ShopDetails"
import ShopSectionNav from "../components/Shops/ShopSectionNav/ShopSectionNav"
import ShopGlance from "../components/Dashboard/ShopGlance"
import Sales from "../components/Shops/Sales/Sales"
import { ABILITIES, Ability, MEMBER_ROLES, can, givable, holdersOf, mayHandle, roleOnShop, selectRoleOn } from "../lib/roles"
import { roleLine } from "../lib/membership"
import { makeStore, renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import { range, totals } from "./salesFixtures"
import type { RootState } from "../redux/app/store"
import type { IShop, MemberRole } from "../typings/shop"
import type { IUser } from "../typings/user"
import type { ITableCarts } from "../typings/tables"


// What each member role sees and may press (lib/roles.ts, the client's copy of
// the API's ability table), on the shop page, the table sheet, the glance and
// the sales page. docs/manager-tools.md.

vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update() {}
  },
}))

const since = "2026-10-01T09:00:00.000Z"
const account = (id: string, name: string): IUser => ({ _id: id, name, surname: "Demo", email: `${name.toLowerCase()}@example.com`, avatar: "", role: "customer", hasPassword: true })
const sam = { ...account("u2", "Sam"), role: "shopMg" }
const alex = account("u1", "Alex")
const kim = account("u6", "Kim")
const lee = account("u8", "Lee")
const jo = account("u7", "Jo")
const root = { ...account("u9", "Root"), role: "admin" }
const byRole: Record<MemberRole, IUser> = { owner: sam, manager: alex, till: kim, floor: lee, kitchen: jo }

const latte = { _id: "m1", name: "Latte", image: "", short_description: "Hot", description: "", price: 3, available: true, category: "drinks" }
const cafe = {
  _id: "s1", name: "Cafe", cover: "", bio: "Coffee", open_times: "8-5", phone: "", web_URL: "", timeZone: "Europe/London",
  shopMg: ["u2", "u1", "u6", "u8", "u7"], ownerId: "u2",
  members: [
    { userId: "u2", role: "owner", since },
    { userId: "u1", role: "manager", since, addedBy: "u2" },
    { userId: "u6", role: "till", since, addedBy: "u2" },
    { userId: "u8", role: "floor", since, addedBy: "u1" },
    { userId: "u7", role: "kitchen", since, addedBy: "u1" },
  ],
  menu: [latte], tables: [{ _id: "t1", name: "Window", Qr_Url: "" }],
  deletedTables: [{ _id: "t9", name: "Garden", deletedAt: since, needsAttention: true }],
} as IShop

// A table with an open cart: Ada ordered two lattes, paid one by card, and
// holds a selection on the other; a pay-back is owed at the table.
const carts: ITableCarts = {
  open: [{
    _id: "c1", tableId: "t1", status: "open",
    items: [{ _id: "i1", menuId: latte, qty: 2, qtyPayed: 1 }],
    split: [
      { _id: "sp1", userId: { _id: "d1", name: "Ada" }, menuId: latte, qty: 1, splitStatus: "closed", unitPrice: 3 },
      { _id: "sp2", userId: { _id: "d1", name: "Ada" }, menuId: latte, qty: 1, splitStatus: "open", claimedAt: since },
    ],
    payments: [{ _id: "p1", provider: "stripe", status: "completed", providerCheckoutId: "pi_1", providerPaymentId: "ch_1", currency: "GBP", userId: { _id: "d1", name: "Ada" }, paidAt: since, amount: 3, lines: [{ menuId: "m1", name: "Latte", qty: 1, unitPrice: 3, refundedQty: 0 }] }],
    refunds: [], managerLog: [],
  } as unknown as ITableCarts["open"][number]],
  recentlyClosed: [],
  paybacks: [{ _id: "pb1", shopId: "s1", tableId: "t1", cartId: "c0", kind: "refundRefused", userId: { _id: "d1", name: "Ada" }, amount: 6, currency: "GBP", paymentIntentId: "pi_0", owed: true, at: since }],
}

const signedIn = (user: IUser, shops: IShop[] = [cafe], dataStatus: RootState["shops"]["dataStatus"] = "ready"): Partial<RootState> => ({
  user: { data: user, status: "authenticated" },
  shops: { data: shops, selected: null, selectedMenu: null, dataStatus },
})

let requests: string[]
beforeEach(() => {
  requests = []
  server.use(
    http.get(`${BASE}/shops/s1`, () => HttpResponse.json({ ...cafe, members: undefined, ownerId: undefined })),
    http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe])),
    http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([{ tableId: "t1", name: "Window", state: "ordering", owed: 3, paid: 3, attention: [] }])),
    http.get(`${BASE}/shops/s1/tables/t1/carts`, () => HttpResponse.json(carts)),
    http.get(`${BASE}/shops/s1/staff`, () => HttpResponse.json({ members: [] })),
    http.get(`${BASE}/shops/s1/sales`, ({ request }) => {
      requests.push(`GET ${new URL(request.url).pathname}`)
      return HttpResponse.json({ range: range("2026-10-05", "2026-10-11", 7), totals: totals(), series: [], heatmap: [], items: [], refunds: { count: 0, byReason: [], byHour: [] }, tables: [] })
    })
  )
})

describe("the ability table", () => {
  it("is the API's: what each role holds, who holds each ability", () => {
    const held = (role: MemberRole) => (Object.keys(ABILITIES) as Ability[]).filter((a) => can(role, a))
    expect(held("owner")).toEqual(Object.keys(ABILITIES))
    expect(held("manager")).toEqual(Object.keys(ABILITIES).filter((a) => a !== "shop.own"))
    expect(held("till")).toEqual(["menu.availability", "tables.read", "carts.fix", "payments.manage", "staff.read"])
    expect(held("floor")).toEqual(["menu.availability", "tables.read", "carts.fix", "staff.read"])
    expect(held("kitchen")).toEqual(["menu.availability", "tables.read", "staff.read"])
    expect(holdersOf(["payments.manage"])).toEqual(["owner", "manager", "till"])
    for (const a of Object.keys(ABILITIES) as Ability[]) {
      expect(can("admin", a)).toBe(true)
      expect(can("unknown", a)).toBe(true)
      expect(can(undefined, a)).toBe(false)
    }
  })

  it("says who handles whom, and which roles each may give", () => {
    expect(givable("owner")).toEqual(["manager", "till", "floor", "kitchen"])
    expect(givable("admin")).toEqual(["manager", "till", "floor", "kitchen"])
    expect(givable("manager")).toEqual(["till", "floor", "kitchen"])
    for (const role of ["till", "floor", "kitchen"] as const) expect(givable(role)).toEqual([])
    expect(mayHandle("manager", "manager")).toBe(false)
    expect(mayHandle("owner", "owner")).toBe(false)
    expect(MEMBER_ROLES).toEqual(["owner", "manager", "till", "floor", "kitchen"])
  })

  it("reads the account's role from its row on the shop, in the four states", () => {
    for (const role of MEMBER_ROLES) expect(roleOnShop(byRole[role], cafe)).toBe(role)
    expect(roleOnShop(root, cafe)).toBe("admin")
    // The row decides whatever the load status; a shop from before members is unknown.
    expect(selectRoleOn(makeStore(signedIn(kim, [cafe], "loading")).getState(), "s1")).toBe("till")
    expect(roleOnShop(account("u0", "Zed"), cafe)).toBeUndefined()
    expect(roleOnShop(kim, { ...cafe, members: undefined } as unknown as IShop)).toBe("unknown")
    // No shop yet: unknown once the load failed, undecided until then.
    expect(selectRoleOn(makeStore(signedIn(kim, [], "failed")).getState(), "s1")).toBe("unknown")
    expect(selectRoleOn(makeStore(signedIn(kim, [], "loading")).getState(), "s1")).toBeUndefined()
    expect(selectRoleOn(makeStore(signedIn(kim, [], "ready")).getState(), "s1")).toBeUndefined()
  })

  it("names the role on the account page", () => {
    expect(roleLine(kim, [cafe])).toBe("Till at Cafe")
    expect(roleLine(lee, [cafe])).toBe("Floor at Cafe")
    expect(roleLine(jo, [cafe])).toBe("Kitchen at Cafe")
    expect(roleLine(alex, [cafe])).toBe("Manager at Cafe")
    expect(roleLine(sam, [cafe])).toBe("Owner of Cafe")
  })
})

const renderShopPage = (user: IUser) =>
  renderWithProviders(<ShopDetails />, { preloadedState: signedIn(user), route: "/shop/s1", path: "/shop/:shopId" })

const editors = () => ({
  details: screen.queryByRole("button", { name: "Edit details" }),
  addItem: screen.queryByRole("button", { name: "Add menu item" }),
  editItem: screen.queryByRole("button", { name: "Edit Latte" }),
  addTable: screen.queryByRole("button", { name: "Add table" }),
  editTable: screen.queryByRole("button", { name: "Edit table Window" }),
})

describe("the shop page", () => {
  it("gives the owner and a manager every editor", async () => {
    for (const user of [sam, alex]) {
      const { unmount } = renderShopPage(user)
      await screen.findByText("Latte")
      await screen.findByRole("button", { name: "Edit table Window" })
      expect(Object.values(editors()).every(Boolean)).toBe(true)
      unmount()
    }
  })

  it("gives the till, the floor and the kitchen the page to read, with the switch and the QR codes, and no editor", async () => {
    for (const user of [kim, lee, jo]) {
      const { unmount } = renderShopPage(user)
      await screen.findByText("Latte")
      await screen.findByRole("button", { name: "View table Window" })
      expect(editors()).toEqual({ details: null, addItem: null, editItem: null, addTable: null, editTable: null })
      expect(screen.getByRole("switch", { name: "Latte available" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Print QR codes" })).toBeInTheDocument()
      // The deleted tables are listed; the money line is the till's.
      expect(screen.getByRole("button", { name: "View deleted table Garden" })).toBeInTheDocument()
      expect(screen.getByText(user === kim ? "Their recent carts, to refund or check if needed." : "Their recent carts.")).toBeInTheDocument()
      unmount()
    }
  })

  it("keeps the heading rows the same height whether or not a role has a button", async () => {
    renderShopPage(jo)
    await screen.findByText("Latte")
    const slots = document.querySelectorAll(".page-head .actions")
    expect(slots.length).toBeGreaterThanOrEqual(3)
    // Reserved in CSS (index.css): the slot exists even when empty.
    for (const slot of slots) expect(slot).toBeInTheDocument()
  })
})

const openSheet = async (user: IUser) => {
  const utils = renderShopPage(user)
  await utils.user.click(await screen.findByRole("button", { name: "View table Window" }))
  const sheet = await screen.findByRole("dialog")
  await within(sheet).findByText(/Ada: 1× Latte/)
  return { ...utils, sheet }
}
const sheetButtons = (sheet: HTMLElement) => within(sheet).queryAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim())

describe("the table sheet", () => {
  it("gives the till every action, money included", async () => {
    const { sheet } = await openSheet(kim)
    const buttons = sheetButtons(sheet)
    expect(buttons).toEqual(expect.arrayContaining(["Release Ada's selection of 1× Latte", "Close table", "Refund items from Ada's payment of £3.00"]))
    expect(within(sheet).getByRole("list", { name: "Owed" })).toBeInTheDocument()
  })

  it("gives the floor the cart fixes and no money: no refund, no pay-backs, no refund instructions", async () => {
    const { sheet } = await openSheet(lee)
    const buttons = sheetButtons(sheet)
    expect(buttons).toEqual(expect.arrayContaining(["Release Ada's selection of 1× Latte", "Close table"]))
    expect(buttons.some((b) => /refund/i.test(b ?? ""))).toBe(false)
    expect(within(sheet).queryByRole("list", { name: "Owed" })).not.toBeInTheDocument()
    expect(within(sheet).queryByText(/Refund this payment from/)).not.toBeInTheDocument()
  })

  it("gives the kitchen the sheet to read: the items, selections, payments and log, nothing to press", async () => {
    const { sheet } = await openSheet(jo)
    expect(within(sheet).getByText(/Ada: 1× Latte/)).toBeInTheDocument()
    expect(within(sheet).getAllByText("£3.00").length).toBeGreaterThan(0)
    const actions = sheetButtons(sheet).filter((b) => b !== "Close")
    expect(actions).toEqual([])
  })
})

describe("the Sales tab, the glance and the sales page", () => {
  it("shows the Sales tab to the owner and a manager only", () => {
    for (const [user, shown] of [[sam, true], [alex, true], [kim, false], [lee, false], [jo, false], [root, true]] as const) {
      const { unmount } = renderWithProviders(<ShopSectionNav shopId="s1" salesPage={false} />, { preloadedState: signedIn(user) })
      expect(!!screen.queryByRole("link", { name: "Sales" })).toBe(shown)
      unmount()
    }
  })

  it("draws the glance's figures for a manager, and the tables' line alone, without the sales read, for a till", async () => {
    const { unmount } = renderWithProviders(<ShopGlance shop={cafe} />, { preloadedState: signedIn(alex) })
    await screen.findByText("Net sales today")
    // The week and today: two reads of the report.
    await waitFor(() => expect(requests).toEqual(["GET /api/shops/s1/sales", "GET /api/shops/s1/sales"]))
    unmount()
    requests = []
    renderWithProviders(<ShopGlance shop={cafe} />, { preloadedState: signedIn(kim) })
    expect(await screen.findByText(/Updated/)).toBeInTheDocument()
    expect(screen.queryByText("Net sales today")).not.toBeInTheDocument()
    expect(document.querySelector(".glance-footer-alone")).toBeInTheDocument()
    expect(document.querySelector(".glance")).not.toHaveAttribute("aria-busy")
    expect(requests).toEqual([])
  })

  it("tells a kitchen member the report isn't theirs, asking nothing; asks for a manager", async () => {
    const { unmount } = renderWithProviders(<Sales />, { preloadedState: signedIn(jo), route: "/shop/s1/sales", path: "/shop/:shopId/sales" })
    expect(await screen.findByText(/The sales report isn't part of your role on this shop/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to the shop" })).toHaveAttribute("href", "/shop/s1")
    expect(requests).toEqual([])
    unmount()
    renderWithProviders(<Sales />, { preloadedState: signedIn(alex), route: "/shop/s1/sales", path: "/shop/:shopId/sales" })
    await waitFor(() => expect(requests).toEqual(["GET /api/shops/s1/sales"]))
  })
})
