import { describe, it, expect, vi, afterEach } from "vitest"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import TableList from "../components/Tables/TableList/TableList"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import { useVisiblePolling } from "../lib/useVisiblePolling"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"
import type { IMenu } from "../typings/menu"
import type { ICart } from "../typings/cart"
import type { ITableCarts, ITableStatus } from "../typings/tables"

// The QR library draws on a canvas, which jsdom doesn't have.
vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update() {}
  },
}))

const menu = (id: string, name: string, price: number, available = true): IMenu => ({
  _id: id, name, price, available, image: "", short_description: "", description: "", category: "drinks",
})

const shop = {
  _id: "s1",
  name: "Cafe",
  tables: ["1", "2", "3", "4"].map((n) => ({ _id: `t${n}`, name: n, Qr_Url: `https://x/t${n}` })),
  menu: [],
} as unknown as IShop

const statuses: ITableStatus[] = [
  { tableId: "t1", name: "1", state: "free", owed: 0, paid: 0, attention: [] },
  { tableId: "t2", name: "2", state: "ordering", owed: 9, paid: 0, attention: ["soldOut"] },
  { tableId: "t3", name: "3", state: "waitingToPay", owed: 6, paid: 0, attention: ["staleSelection"] },
  { tableId: "t4", name: "4", state: "partlyPaid", owed: 3, paid: 3, attention: ["duplicateCarts"] },
]

const renderTables = () =>
  renderWithProviders(<TableList shopId="s1" />, {
    preloadedState: { shops: { data: [shop], selected: shop, selectedMenu: null } },
  })

// The card holding a table's title.
const card = (name: string) => screen.getByRole("button", { name: `View table ${name}` }).closest(".card") as HTMLElement

describe("table cards", () => {
  it("show each table's state, what's owed and what needs a look, in words", async () => {
    server.use(http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json(statuses)))
    renderTables()

    await waitFor(() => expect(within(card("1")).getByText("Free")).toBeInTheDocument())
    expect(within(card("1")).queryByText(/Owed/)).not.toBeInTheDocument()
    expect(within(card("2")).getByText("Ordering")).toBeInTheDocument()
    expect(within(card("2")).getByText(/Owed/)).toHaveTextContent("Owed £9.00")
    expect(within(card("2")).getByText("Sold-out item in the cart")).toBeInTheDocument()
    expect(within(card("3")).getByText("Waiting to pay")).toBeInTheDocument()
    expect(within(card("3")).getByText("Selection held over 15 min")).toBeInTheDocument()
    expect(within(card("4")).getByText("Partly paid")).toBeInTheDocument()
    expect(within(card("4")).getByText("More than one open cart")).toBeInTheDocument()
  })

  it("show no status, but still work, when it can't be loaded", async () => {
    let asked = false
    server.use(
      http.get(`${BASE}/shops/s1/tables/status`, () => {
        asked = true
        return HttpResponse.json({ message: "boom" }, { status: 500 })
      })
    )
    renderTables()

    await waitFor(() => expect(asked).toBe(true))
    expect(screen.queryByText("Free")).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /View table/ })).toHaveLength(4)
  })
})

describe("table sheet", () => {
  const minutesAgo = (m: number) => new Date(Date.now() - m * 60000).toISOString()
  const latte = menu("m1", "Latte", 3)
  const muffin = menu("m2", "Muffin", 2.5, false)
  const carts: ITableCarts = {
    open: [
      {
        _id: "c1",
        tableId: "t3",
        status: "open",
        items: [
          { _id: "i1", menuId: latte, qty: 3, qtyPayed: 1 },
          { _id: "i2", menuId: muffin, qty: 1, qtyPayed: 0 },
        ],
        split: [
          { _id: "s1", userId: { _id: "u1", name: "Ada" }, menuId: latte, qty: 1, splitStatus: "open", claimedAt: minutesAgo(20) },
          { _id: "s2", userId: { _id: "u2", name: "Bo" }, menuId: latte, qty: 1, splitStatus: "open", claimedAt: minutesAgo(2) },
          { _id: "s3", userId: { _id: "u1", name: "Ada" }, menuId: latte, qty: 1, splitStatus: "closed", unitPrice: 3 },
          // Paid before prices were recorded.
          { _id: "s4", userId: { _id: "u3", name: "Cy" }, menuId: muffin, qty: 1, splitStatus: "closed" },
        ],
        payments: [
          {
            _id: "p1", provider: "paypal", providerCheckoutId: "O1", providerPaymentId: "C1", currency: "GBP",
            userId: { _id: "u1", name: "Ada" }, paidAt: new Date().toISOString(), amount: 3,
            lines: [{ menuId: "m1", name: "Latte", qty: 1, unitPrice: 3, refundedQty: 0 }],
          },
        ],
      },
    ],
    recentlyClosed: [
      { _id: "c0", tableId: "t3", status: "closed", items: [], split: [], payments: [], updatedAt: minutesAgo(90) },
    ],
  }

  it("shows the table's items, who has selected what and for how long, and its payments", async () => {
    server.use(
      http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json(statuses)),
      http.get(`${BASE}/shops/s1/tables/t3/carts`, () => HttpResponse.json(carts))
    )
    const { user } = renderTables()

    await user.click(screen.getByRole("button", { name: "View table 3" }))
    const sheet = await screen.findByRole("dialog")
    expect(within(sheet).getByText("Table 3")).toBeInTheDocument()
    await within(sheet).findByText("Latte")

    // Items: ordered, paid, selected.
    expect(within(sheet).getByText("Ordered 3 · Paid 1 · Selected 2")).toBeInTheDocument()
    expect(within(sheet).getByText("Ordered 1 · Paid 0 · Selected 0")).toBeInTheDocument()
    expect(within(sheet).getByText("Sold out")).toBeInTheDocument()
    // Selections, the long-held one marked.
    expect(within(sheet).getByText(/Ada: 1× Latte/)).toHaveTextContent("held 20 min")
    expect(within(sheet).getByText(/Bo: 1× Latte/)).toHaveTextContent("held 2 min")
    // Payments: the recorded one, and the older one without details.
    expect(within(sheet).getByText(/^Ada ·/).closest("li")).toHaveTextContent("£3.00")
    expect(within(sheet).getByText("Paid, details unavailable").closest("li")).toHaveTextContent("1× Muffin")
    // Carts closed today, collapsed.
    expect(within(sheet).getByText("Closed in the last 24 hours (1)").closest("details")).not.toHaveAttribute("open")
  })

  it("says so when the table has no open cart", async () => {
    server.use(
      http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json(statuses)),
      http.get(`${BASE}/shops/s1/tables/t1/carts`, () => HttpResponse.json({ open: [], recentlyClosed: [] }))
    )
    const { user } = renderTables()

    await user.click(screen.getByRole("button", { name: "View table 1" }))
    expect(await screen.findByText("No open cart: this table is free.")).toBeInTheDocument()
  })
})

describe("useVisiblePolling", () => {
  const Poller = ({ load }: { load: () => void }) => {
    useVisiblePolling(load, 1000)
    return null
  }
  const setVisibility = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state })
    document.dispatchEvent(new Event("visibilitychange"))
  }

  afterEach(() => {
    vi.useRealTimers()
    setVisibility("visible")
  })

  it("loads now and on every tick, stops while the page is hidden, and loads again on return", () => {
    vi.useFakeTimers()
    const load = vi.fn()
    render(<Poller load={load} />)
    expect(load).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(2000))
    expect(load).toHaveBeenCalledTimes(3)

    act(() => setVisibility("hidden"))
    act(() => vi.advanceTimersByTime(5000))
    expect(load).toHaveBeenCalledTimes(3)

    act(() => setVisibility("visible"))
    expect(load).toHaveBeenCalledTimes(4)
    act(() => vi.advanceTimersByTime(1000))
    expect(load).toHaveBeenCalledTimes(5)
  })
})

describe("diner's Total Payed", () => {
  it("counts paid units at the price they were paid at, not today's", async () => {
    // A Latte paid at £3 that now costs £9, and one more still to pay.
    const cart: ICart = {
      _id: "cart1", userId: "u1", tableId: "t1", status: "open",
      items: [{ _id: "i1", menuId: menu("m1", "Latte", 9), qty: 2, qtyPayed: 1 }],
      split: [{ _id: "s1", userId: "u2", menuId: menu("m1", "Latte", 9), qty: 1, splitStatus: "closed", unitPrice: 3 }],
    }
    server.use(http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart)))
    renderWithProviders(<CartListItems />, {
      preloadedState: {
        user: { data: { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" }, status: "authenticated" },
        carts: { data: structuredClone(cart), pointers: { shopId: "s1", tableId: "t1" } },
      },
      route: "/shops/s1/tables/t1/cart",
      path: "/shops/:shopId/tables/:tableId/cart",
    })

    expect(await screen.findByText(/Total Payed/)).toHaveTextContent("£3.00")
    // One £9 Latte still to pay (the old sum, 2 × £9 − £3, said £15).
    expect(screen.getByText(/Remaining Cart Total/)).toHaveTextContent("£9.00")
  })
})
