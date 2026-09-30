import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import TableList from "../components/Tables/TableList/TableList"
import TableModal from "../components/Tables/TableModal/TableModal"
import CartNotices from "../components/Customers/CartNotices/CartNotices"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"
import type { IMenu } from "../typings/menu"
import type { ITableCarts, ITableStatus } from "../typings/tables"

vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update() {}
  },
}))

const menu = (id: string, name: string, price: number): IMenu => ({
  _id: id, name, price, available: true, image: "", short_description: "", description: "", category: "drinks",
})
const latte = menu("m1", "Latte", 3)
const muffin = menu("m2", "Muffin", 2)

const shop = {
  _id: "s1", name: "Cafe", menu: [],
  tables: [{ _id: "t4", name: "4", Qr_Url: "https://x/t4" }],
} as unknown as IShop

const status: ITableStatus = { tableId: "t4", name: "4", state: "waitingToPay", owed: 8, paid: 3, attention: [] }

// Table 4: 3 Lattes (1 paid) and 1 Muffin; Ada and Bo each hold a Latte.
const tableCarts = (): ITableCarts => ({
  open: [
    {
      _id: "c1", tableId: "t4", status: "open",
      items: [
        { _id: "i1", menuId: latte, qty: 3, qtyPayed: 1 },
        { _id: "i2", menuId: muffin, qty: 1, qtyPayed: 0 },
      ],
      split: [
        { _id: "s1", userId: { _id: "u1", name: "Ada" }, menuId: latte, qty: 1, splitStatus: "open" },
        { _id: "s2", userId: { _id: "u2", name: "Bo" }, menuId: latte, qty: 1, splitStatus: "open" },
        { _id: "s3", userId: { _id: "u1", name: "Ada" }, menuId: latte, qty: 1, splitStatus: "closed", unitPrice: 3 },
      ],
      payments: [],
    },
  ],
  recentlyClosed: [],
})

let carts: ITableCarts
let cartLoads = 0
let statusLoads = 0
const posted: { action: string; body: unknown }[] = []
let answer: () => Response

beforeEach(() => {
  carts = tableCarts()
  cartLoads = 0
  statusLoads = 0
  posted.length = 0
  answer = () => HttpResponse.json({ ...carts.open[0] })
  server.use(
    http.get(`${BASE}/shops/s1/tables/status`, () => {
      statusLoads++
      return HttpResponse.json([status])
    }),
    http.get(`${BASE}/shops/s1/tables/t4/carts`, () => {
      cartLoads++
      return HttpResponse.json(carts)
    }),
    http.post(`${BASE}/shops/s1/tables/t4/carts/:cartId/:action`, async ({ params, request }) => {
      posted.push({ action: String(params.action), body: await request.json().catch(() => null) })
      return answer()
    })
  )
})

const openSheet = async () => {
  const utils = renderWithProviders(<TableList shopId="s1" />, {
    preloadedState: { shops: { all: [], data: [shop], selected: shop, selectedMenu: null } },
  })
  await utils.user.click(screen.getByRole("button", { name: "View table 4" }))
  const sheet = await screen.findByRole("dialog")
  await within(sheet).findAllByText("Items") // loaded
  return { ...utils, sheet }
}

describe("table sheet actions", () => {
  it("closing says what will be dropped, then closes, reloads the sheet and refreshes the cards", async () => {
    answer = () => HttpResponse.json({ deleted: false, dropped: [], cart: carts.open[0] })
    const { user, sheet } = await openSheet()
    const loadsBefore = cartLoads
    const statusBefore = statusLoads

    await user.click(within(sheet).getByRole("button", { name: "Close table" }))
    expect(within(sheet).getByText(/^Close Table 4\?/)).toHaveTextContent(
      "Close Table 4? 3 unpaid items will be dropped: 2× Latte, 1× Muffin. Paid items stay on record. The next party at this table starts a new cart."
    )
    expect(within(sheet).getByText(/^Close Table 4\?/)).toHaveFocus()
    expect(posted).toEqual([]) // nothing until confirmed

    const confirm = within(sheet).getAllByRole("button", { name: "Close table" }).at(-1)!
    expect(confirm).toHaveClass("btn-danger")
    await user.click(confirm)

    expect(await within(sheet).findByText("Table closed.")).toBeInTheDocument()
    expect(posted).toEqual([{ action: "close", body: {} }])
    await waitFor(() => expect(cartLoads).toBeGreaterThan(loadsBefore))
    await waitFor(() => expect(statusLoads).toBeGreaterThan(statusBefore))
  })

  it("says the cart will be deleted when nothing on it was paid", async () => {
    carts.open[0].items = [{ _id: "i2", menuId: muffin, qty: 2, qtyPayed: 0 }]
    carts.open[0].split = []
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Close table" }))
    expect(within(sheet).getByText(/^Close Table 4\?/)).toHaveTextContent(
      "2 unpaid items will be dropped: 2× Muffin. Nothing on it was paid, so the cart will be deleted."
    )
  })

  it("releases one diner's selection", async () => {
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Release Ada's selection of 1× Latte" }))
    expect(within(sheet).getByText(/^Release Ada's selection/)).toHaveTextContent(
      "Release Ada's selection of 1× Latte? Anyone at the table can then pay for it. Ada will see a note."
    )
    await user.click(within(sheet).getByRole("button", { name: "Release" }))

    expect(await within(sheet).findByText("Released Ada's selection of 1× Latte.")).toBeInTheDocument()
    expect(posted).toEqual([{ action: "releaseSelection", body: { userId: "u1", menuId: "m1" } }])
  })

  it("releases only a deleted diner's selection, not everyone's", async () => {
    carts.open[0].split[0].userId = null
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Release a diner's selection of 1× Latte" }))
    await user.click(within(sheet).getByRole("button", { name: "Release" }))

    await within(sheet).findByText("Released A diner's selection of 1× Latte.")
    expect(posted).toEqual([{ action: "releaseSelection", body: { userId: null, menuId: "m1" } }])
  })

  it("releases every selection at once", async () => {
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Release all" }))
    await user.click(within(sheet).getAllByRole("button", { name: "Release all" }).at(-1)!)
    await within(sheet).findByText("Released all selections.")
    expect(posted).toEqual([{ action: "releaseSelection", body: {} }])
  })

  it("removes an item's unpaid units, saying the paid ones stay", async () => {
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Remove 2 unpaid" }))
    expect(within(sheet).getByText(/^Remove 2× Latte/)).toHaveTextContent(
      "Remove 2× Latte (unpaid) from the table's cart? Any selections on it are released. The 1 paid stays on record."
    )
    await user.click(within(sheet).getByRole("button", { name: "Remove" }))
    await within(sheet).findByText("Removed 2× Latte.")
    expect(posted).toEqual([{ action: "removeItem", body: { menuId: "m1" } }])
  })

  it("does nothing when cancelled", async () => {
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Close table" }))
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }))
    expect(within(sheet).queryByText(/^Close Table 4\?/)).not.toBeInTheDocument()
    expect(posted).toEqual([])
  })

  it("offers a merge only on an older duplicate cart", async () => {
    const { sheet } = await openSheet()
    expect(within(sheet).queryByRole("button", { name: "Merge into the newest cart" })).not.toBeInTheDocument()
  })

  it("merges an older duplicate cart into the newest", async () => {
    carts.open.push({ ...tableCarts().open[0], _id: "c0" })
    const { user, sheet } = await openSheet()

    expect(within(sheet).getByText("Open cart 2 of 2 (not shown to diners)")).toBeInTheDocument()
    const merges = within(sheet).getAllByRole("button", { name: "Merge into the newest cart" })
    expect(merges).toHaveLength(1)
    await user.click(merges[0])
    await user.click(within(sheet).getByRole("button", { name: "Merge carts" }))
    await within(sheet).findByText("Carts merged.")
    expect(posted).toEqual([{ action: "mergeInto", body: {} }])
  })

  it("explains a cart that changed meanwhile, and shows it again", async () => {
    answer = () => HttpResponse.json({ message: "The cart changed, please retry" }, { status: 409 })
    const { user, sheet } = await openSheet()
    const loadsBefore = cartLoads

    await user.click(within(sheet).getByRole("button", { name: "Close table" }))
    await user.click(within(sheet).getAllByRole("button", { name: "Close table" }).at(-1)!)

    expect(await within(sheet).findByText(/^The table changed while you were looking/)).toBeInTheDocument()
    await waitFor(() => expect(cartLoads).toBeGreaterThan(loadsBefore))
  })

  it("returns focus to the action when its question is cancelled", async () => {
    const { user, sheet } = await openSheet()
    const action = within(sheet).getByRole("button", { name: "Remove 1 unpaid" })

    await user.click(action)
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }))

    await waitFor(() => expect(action).toHaveFocus())
  })

  it("shows the BE's reason for any other refusal", async () => {
    answer = () => HttpResponse.json({ message: "Nothing unpaid to remove" }, { status: 409 })
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Remove 1 unpaid" }))
    await user.click(within(sheet).getByRole("button", { name: "Remove" }))
    expect(await within(sheet).findByText("Nothing unpaid to remove. Here's the table as it is now.")).toBeInTheDocument()
  })
})

describe("deleting a table", () => {
  it("names the saved table, not an unsaved rename", async () => {
    const { user } = renderWithProviders(<TableModal shopId="s1" tableId="t4" show handleClose={() => {}} />, {
      preloadedState: { shops: { all: [], data: [shop], selected: shop, selectedMenu: null } },
    })
    const name = screen.getByPlaceholderText("Name")
    await waitFor(() => expect(name).toHaveValue("4"))
    await user.clear(name)
    await user.type(name, "Terrace")

    await user.click(screen.getByRole("button", { name: "Delete table" }))

    expect(screen.getByText("Delete table 4? Its QR code will no longer take orders.")).toBeInTheDocument()
  })
})

describe("deleting a table with an open cart", () => {
  it("shows the BE's reason", async () => {
    server.use(
      http.delete(`${BASE}/shops/s1/tables/t4`, () =>
        HttpResponse.json({ message: "This table has an open cart — close it first" }, { status: 409 })
      )
    )
    const { user } = renderWithProviders(<TableModal shopId="s1" tableId="t4" show handleClose={() => {}} />, {
      preloadedState: { shops: { all: [], data: [shop], selected: shop, selectedMenu: null } },
    })

    await user.click(screen.getByRole("button", { name: "Delete table" }))
    expect(screen.getByText(/Its QR code will no longer take orders/)).toHaveFocus()
    await user.click(screen.getAllByRole("button", { name: "Delete table" }).at(-1)!)
    expect(await screen.findByText("This table has an open cart — close it first")).toBeInTheDocument()
    // The question goes, so the reason shows with the dialog's usual buttons,
    // and focus is back on Delete table.
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Delete table" })).toHaveFocus())
  })
})

describe("diner notices", () => {
  const notices = [4, 3, 2, 1].map((n) => ({ _id: `n${n}`, at: "2026-09-28T12:00:00Z", message: `Note ${n}` }))

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("shows the 3 newest in a status region, and a dismissed one stays gone on this device", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<CartNotices notices={notices} />)

    const region = screen.getByRole("status")
    expect(within(region).getAllByText(/^Note/).map((n) => n.textContent)).toEqual(["Note 4", "Note 3", "Note 2"])

    await user.click(within(screen.getByText("Note 4").closest(".alert") as HTMLElement).getByRole("button"))
    expect(screen.queryByText("Note 4")).not.toBeInTheDocument()
    expect(screen.getByText("Note 1")).toBeInTheDocument()

    unmount()
    render(<CartNotices notices={notices} />)
    expect(screen.queryByText("Note 4")).not.toBeInTheDocument()
  })

  it("still works when browser storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    const user = userEvent.setup()
    render(<CartNotices notices={notices} />)

    await user.click(within(screen.getByText("Note 4").closest(".alert") as HTMLElement).getByRole("button"))
    expect(screen.queryByText("Note 4")).not.toBeInTheDocument()
  })

  it("keeps an empty status region when there's nothing to say", () => {
    render(<CartNotices notices={[]} />)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })
})
