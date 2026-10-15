import { describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import Dashboard from "../components/Dashboard/Dashboard"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import { bucket, range, shop as cafe, totals } from "./salesFixtures"
import { addDays, todayIn } from "../lib/sales"
import type { IShop } from "../typings/shop"
import type { ISalesReport } from "../typings/sales"
import type { ITableStatus } from "../typings/tables"

// My Shops for a manager: each shop's card carries its figures (today, the
// last seven days, the best seller, a highlight) and what its tables need,
// from the sales report with a fixed range and the tables' status.

const manager = { _id: "u1", name: "Sam", surname: "Demo", email: "manager@mail.com", role: "shopMg", hasPassword: true }
const today = todayIn("Europe/London")
const from = addDays(today, -6)
const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
const deli: IShop = { ...cafe, _id: "s2", name: "Deli", deletedTables: [{ _id: "d1", name: "Old", deletedAt: "2026-10-01T10:00:00.000Z", needsAttention: true }] }

const sold: ISalesReport = {
  range: range(from, today, 7),
  totals: totals({ gross: 1300, refunds: 60, net: 1240, orders: 150, visits: 90, diners: 40, returningDiners: 30 }),
  series: days.map((d) => bucket(d, d === today ? { net: 184.5, orders: 23 } : { net: 175.92, orders: 21 })),
  heatmap: [],
  items: [
    { menuId: "m1", name: "Latte", category: "drinks", unitPrice: 2.5, units: 88, refundedUnits: 0, revenue: 220 },
    { menuId: "m2", name: "Lamb Shoulder", category: "food", unitPrice: 22, units: 5, refundedUnits: 0, revenue: 110 },
  ],
  refunds: { count: 0, byReason: [], byHour: [] },
  tables: [],
  previous: { range: range(addDays(from, -7), addDays(from, -1), 7), totals: totals({ net: 1000, orders: 100 }), series: [] },
}
const quiet: ISalesReport = { ...sold, totals: totals(), series: days.map((d) => bucket(d)), items: [], previous: { ...sold.previous!, totals: totals() } }

const statuses: ITableStatus[] = [
  { tableId: "t1", name: "Window", state: "ordering", owed: 30, paid: 0, attention: ["soldOut", "payBack"] },
  { tableId: "t2", name: "Garden", state: "waitingToPay", owed: 12, paid: 5, attention: [] },
]

const requests: string[] = []
const card = async (name: string) => (await screen.findByRole("heading", { name })).closest("li")!

describe("My Shops", () => {
  beforeEach(() => {
    requests.length = 0
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(manager)),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe, deli])),
      http.get(`${BASE}/shops/:shopId/sales`, ({ request, params }) => {
        requests.push(new URL(request.url).search)
        return HttpResponse.json(params.shopId === "s1" ? sold : quiet)
      }),
      http.get(`${BASE}/shops/:shopId/tables/status`, ({ params }) => HttpResponse.json(params.shopId === "s1" ? statuses : []))
    )
  })

  const render = () => renderWithProviders(<Dashboard />, { preloadedState: { user: { data: manager, status: "authenticated" } } })

  it("shows each shop's figures, best seller and highlight, linking to its sales page for the same week", async () => {
    render()
    const c = within(await card("Cafe"))
    expect(await c.findByText("£184.50")).toBeInTheDocument()
    expect(c.getByText("23 orders")).toBeInTheDocument()
    expect(c.getByText("£1,240.00")).toBeInTheDocument()
    // Up on the week before, in green, the direction said in words for a screen reader.
    const delta = c.getByText(/24\.0% vs the week before/).closest(".glance-delta")!
    expect(delta).toHaveClass("good")
    expect(delta).toHaveTextContent("▲ up 24.0% vs the week before")
    expect(c.getByText("Latte")).toBeInTheDocument()
    expect(c.getByText("£220.00 · 88 sold")).toBeInTheDocument()
    // The highlight says what the change beside the week doesn't, of the week.
    expect(c.getByText("Orders are up 50.0% on the week before.")).toBeInTheDocument()
    // The figures are the link to the Sales tab on the same week.
    const sales = c.getByRole("link", { name: /^Sales report for Cafe:/ })
    expect(sales).toHaveAttribute("href", `/shop/s1/sales?from=${from}&to=${today}`)
    expect(sales).toHaveTextContent("Sales report ›")
    expect(sales).toContainElement(c.getByText("Latte"))
    expect(c.getByRole("link", { name: "Cafe" })).toHaveAttribute("href", "/shop/s1")
    // Asked for today and the six days before, by day, against the week before.
    expect(requests.filter((q) => q.includes("compare=previous"))).toHaveLength(2)
    expect(requests[0]).toBe(`?from=${from}&to=${today}&by=day&compare=previous`)
  })

  it("says what the tables need, linking to them, and that nothing does", async () => {
    render()
    const cafeCard = within(await card("Cafe"))
    const needs = await cafeCard.findByRole("link", { name: "1 table needs attention £42.00 owed 1 pay-back at Cafe" })
    expect(needs).toHaveAttribute("href", "/shop/s1#tableList")
    expect(needs.closest(".glance-tables")).toHaveClass("attention")
    expect(needs.querySelectorAll(".badge")).toHaveLength(3)
    // The deli's open tables are quiet, but a deleted table still needs a look.
    const deliCard = within(await card("Deli"))
    expect(await deliCard.findByRole("link", { name: "1 table needs attention at Deli" })).toHaveAttribute("href", "/shop/s2#tableList")
  })

  it("is quiet when the tables need nothing", async () => {
    server.use(http.get(`${BASE}/shops/me`, () => HttpResponse.json([cafe, { ...deli, deletedTables: [] }])))
    render()
    const c = within(await card("Deli"))
    const clear = await c.findByRole("link", { name: "Tables: all clear at Deli" })
    expect(clear.closest(".glance-tables")).toHaveClass("clear")
    expect(clear.querySelector(".badge")).toBeNull()
  })

  it("says so when nothing was sold", async () => {
    render()
    const c = within(await card("Deli"))
    expect(await c.findByText("no orders yet")).toBeInTheDocument()
    expect(c.getByText("nothing sold this week")).toBeInTheDocument()
    expect(c.getByText(/no change vs the week before/)).toBeInTheDocument()
    // No bold zero for a day not started (the week's £0.00 stays), no highlight with nothing to say.
    expect(c.getByText("Net sales today").nextElementSibling!.querySelector(".glance-value")).toBeNull()
    expect(c.getAllByText("£0.00")).toHaveLength(1)
    expect(c.queryByText(/before\./)).not.toBeInTheDocument()
  })

  it("shows a failure on its own card and part only, with a way to try again", async () => {
    let failures = 1
    server.use(
      http.get(`${BASE}/shops/s2/sales`, () => (failures-- > 0 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(quiet)))
    )
    const { user } = render()
    const deliCard = within(await card("Deli"))
    expect(await deliCard.findByText(/Couldn't load the figures\./)).toBeInTheDocument()
    // The tables' line still stands, and the other shop is untouched.
    expect(await deliCard.findByRole("link", { name: "1 table needs attention at Deli" })).toBeInTheDocument()
    expect(await within(await card("Cafe")).findByText("£184.50")).toBeInTheDocument()
    await user.click(deliCard.getByRole("button", { name: "Try again" }))
    expect(await deliCard.findByText("nothing sold this week")).toBeInTheDocument()
    await waitFor(() => expect(deliCard.queryByText(/Couldn't load/)).not.toBeInTheDocument())
  })

  it("says when it was updated, and keeps the figures through a refresh that fails", async () => {
    const { user } = render()
    const c = within(await card("Cafe"))
    expect(await c.findByText("£184.50")).toBeInTheDocument()
    expect(c.getByText(/^Updated \d\d:\d\d$/)).toBeInTheDocument()
    // The next refresh (the tab becoming visible again) fails.
    let failing = true
    server.use(http.get(`${BASE}/shops/s1/sales`, () => (failing ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(sold))))
    document.dispatchEvent(new Event("visibilitychange"))
    expect(await c.findByText(/Couldn't refresh\./)).toBeInTheDocument()
    expect(c.getByText("£184.50")).toBeInTheDocument()
    expect(c.queryByText(/Couldn't load/)).not.toBeInTheDocument()
    failing = false
    await user.click(c.getByRole("button", { name: "Try again" }))
    expect(await c.findByText(/^Updated \d\d:\d\d$/)).toBeInTheDocument()
    expect(c.queryByText(/Couldn't refresh/)).not.toBeInTheDocument()
  })

  it("stands in for the figures while they load, saying so", async () => {
    server.use(http.get(`${BASE}/shops/s1/sales`, async () => { await new Promise((r) => setTimeout(r, 50)); return HttpResponse.json(sold) }))
    render()
    const c = within(await card("Cafe"))
    expect(c.getByRole("status")).toHaveTextContent("Loading Cafe's figures")
    expect(await c.findByText("£184.50")).toBeInTheDocument()
    expect(c.queryByRole("status")).not.toBeInTheDocument()
  })
})
