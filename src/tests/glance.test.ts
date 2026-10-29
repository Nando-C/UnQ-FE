import { describe, it, expect } from "vitest"
import { glanceOf, glanceRange, needsOf, todayRange } from "../lib/glance"
import { findings } from "../lib/findings"
import { bucket, range, totals } from "./salesFixtures"
import type { ISalesReport } from "../typings/sales"
import type { ITableStatus } from "../typings/tables"

// The readings a My Shops card shows, from the week's and today's reports and
// the tables' status (lib/glance.ts).

const days = ["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"]
const report = (over: Partial<ISalesReport> = {}): ISalesReport => ({
  range: range(days[0], days[6], 7),
  totals: totals({ gross: 1300, refunds: 60, net: 1240, orders: 150, visits: 90, diners: 40 }),
  series: days.map((d) => bucket(d, { net: 150, orders: 18 })),
  heatmap: [],
  items: [
    { menuId: "m1", name: "Latte", category: "drinks", unitPrice: 2.5, units: 88, refundedUnits: 0, revenue: 220 },
    { menuId: "m2", name: "Lamb Shoulder", category: "food", unitPrice: 22, units: 5, refundedUnits: 0, revenue: 110 },
  ],
  refunds: { count: 0, byReason: [], byHour: [] },
  tables: [],
  ...over,
})

// Today's report: one day, no week before.
const todayReport = (net = 0, orders = 0): ISalesReport => ({ ...report({ range: range("2026-10-15", "2026-10-15", 1), totals: totals({ net, orders }), series: [bucket("2026-10-15", { net, orders })], items: [] }) })

const status = (over: Partial<ITableStatus> = {}): ITableStatus => ({ tableId: "t1", name: "T1", state: "free", owed: 0, paid: 0, attention: [], ...over })

describe("a shop at a glance", () => {
  it("reads the week as the seven full days to yesterday, and today on its own", () => {
    // A day half done never pulls the week under a full week before.
    expect(glanceRange("2026-10-15")).toEqual({ from: "2026-10-08", to: "2026-10-14" })
    expect(glanceRange("2026-03-02")).toEqual({ from: "2026-02-23", to: "2026-03-01" })
    expect(todayRange("2026-10-15")).toEqual({ from: "2026-10-15", to: "2026-10-15" })
  })

  it("takes today from its report, the week from the totals, and the change on the week before", () => {
    const r = report({ previous: { range: range("2026-10-01", "2026-10-07", 7), totals: totals({ net: 1000, orders: 100 }), series: [] } })
    const g = glanceOf(r, todayReport(184.5, 23))
    expect(g.today).toEqual({ net: 184.5, orders: 23 })
    expect(g.week).toEqual({ net: 1240, orders: 150, change: { direction: "up", text: "24.0%" } })
    // The best seller is the dish with the most revenue, as the sales page ranks them.
    expect(g.bestSeller).toEqual({ name: "Latte", revenue: 220, units: 88 })
    // The first highlight the sales page would write, said of the week.
    expect(findings(r)[0].text).toBe("Orders are up 50.0% on the period before.")
    expect(g.highlight).toBe("Orders are up 50.0% on the week before.")
  })

  it("skips a highlight about net sales, which the card's own change already says", () => {
    const r = report({ previous: { range: range("2026-10-01", "2026-10-07", 7), totals: totals({ net: 1000, orders: 140 }), series: [] } })
    const [first, second] = findings(r)
    expect(first.text).toBe("Net sales are up 24.0% on the period before.")
    expect(glanceOf(r, todayReport()).highlight).toBe(second.text.replace("the period before", "the week before"))
    expect(glanceOf(r, todayReport()).highlight).not.toMatch(/^Net sales/)
  })

  it("is zero for a day not started, and has no change without the week before", () => {
    const g = glanceOf(report(), todayReport())
    expect(g.today).toEqual({ net: 0, orders: 0 })
    expect(g.week.change).toBeNull()
  })

  it("has no best seller or highlight when nothing was sold", () => {
    const g = glanceOf(report({ totals: totals(), series: days.map((d) => bucket(d)), items: [], previous: { range: range("2026-10-01", "2026-10-07", 7), totals: totals(), series: [] } }), todayReport())
    expect(g.bestSeller).toBeNull()
    expect(g.highlight).toBeNull()
    expect(g.week.change).toEqual({ direction: "same", text: "no change" })
  })

  it("counts the tables that need attention, what is owed at them and the diners to pay back", () => {
    const needs = needsOf(
      [
        status({ tableId: "t1", state: "ordering", owed: 30, attention: ["soldOut", "payBack"] }),
        status({ tableId: "t2", state: "waitingToPay", owed: 12, attention: [] }),
        status({ tableId: "t3", attention: ["staleSelection"] }),
      ],
      [{ _id: "d1", name: "Old", deletedAt: "2026-10-01T10:00:00.000Z", needsAttention: true }, { _id: "d2", name: "Older", deletedAt: "2026-09-01T10:00:00.000Z" }]
    )
    expect(needs).toEqual({ flagged: 3, owed: 42, payBacks: 1 })
    expect(needsOf([])).toEqual({ flagged: 0, owed: 0, payBacks: 0 })
  })
})
