import { describe, it, expect, beforeEach } from "vitest"
import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import Sales from "../components/Shops/Sales/Sales"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import { findings } from "../lib/findings"
import { addDays, hourSpan, weekdayCounts, weekdaysIn } from "../lib/sales"
import { bucket, range, shop, totals } from "./salesFixtures"
import type { ISalesReport } from "../typings/sales"

// The sales page below the trend: the findings' rules, and the heatmap, menu,
// refunds, diners and tables sections over one report.

// A week with everything the sections draw: Saturday's lunch the busiest,
// one dish carrying most of the revenue, refunds mostly for a long wait at
// 13:00, a dozen diners of whom half had been before, two tables and a
// deleted one, and the week before to compare with.
const WEEK: ISalesReport = {
  range: range("2026-10-05", "2026-10-11", 7),
  totals: totals({
    gross: 1000, refunds: 50, net: 950, orders: 100, pendingOrders: 2, visits: 80, diners: 20, returningDiners: 10, units: 250,
    byProvider: { paypal: { gross: 400, orders: 40 }, stripe: { gross: 600, orders: 60 } },
  }),
  series: [100, 100, 100, 100, 150, 300, 150].map((gross, i) =>
    bucket(addDays("2026-10-05", i), {
      gross, net: gross, orders: gross / 10, visits: gross / 12.5, diners: 4, newDiners: i < 2 ? 4 : 1,
      byProvider: { paypal: gross * 0.4, stripe: gross * 0.6 },
    })),
  heatmap: [
    { dow: 6, hour: 12, orders: 15, gross: 150 },
    { dow: 6, hour: 13, orders: 15, gross: 150 },
    { dow: 1, hour: 13, orders: 10, gross: 100 },
    { dow: 2, hour: 13, orders: 10, gross: 100 },
    { dow: 3, hour: 13, orders: 10, gross: 100 },
    { dow: 4, hour: 13, orders: 10, gross: 100 },
    { dow: 5, hour: 13, orders: 15, gross: 150 },
    { dow: 7, hour: 9, orders: 15, gross: 150 },
  ],
  items: [
    { menuId: "m1", name: "Sea Bass", category: "food", unitPrice: 18, units: 30, refundedUnits: 1, revenue: 540 },
    { menuId: "m2", name: "Latte", category: "drinks", unitPrice: 3, units: 100, refundedUnits: 0, revenue: 300 },
    { menuId: "m3", name: "Soup", category: "food", unitPrice: 6, units: 20, refundedUnits: 0, revenue: 120 },
    { menuId: "m4", name: "Tea", category: "drinks", unitPrice: 2, units: 20, refundedUnits: 0, revenue: 40 },
  ],
  refunds: {
    count: 5,
    byReason: [{ reason: "long_wait", count: 3, amount: 36 }, { reason: "quality", count: 1, amount: 10 }, { reason: null, count: 1, amount: 4 }],
    byHour: [{ hour: 13, count: 3, amount: 36 }, { hour: 19, count: 2, amount: 14 }],
  },
  tables: [
    { tableId: "t1", name: "Window", orders: 60, visits: 50, gross: 600, refunds: 30, net: 570 },
    { tableId: "t2", name: "Garden", orders: 30, visits: 20, gross: 300, refunds: 20, net: 280 },
    { tableId: "t3", name: null, orders: 10, visits: 10, gross: 100, refunds: 0, net: 100 },
  ],
  previous: {
    range: range("2026-09-28", "2026-10-04", 7),
    totals: totals({ gross: 800, refunds: 40, net: 760, orders: 100, visits: 80, diners: 20, returningDiners: 8, units: 200 }),
    series: Array.from({ length: 7 }, (_, i) => bucket(addDays("2026-09-28", i), { gross: 800 / 7, net: 760 / 7 })),
  },
}

describe("the findings' rules", () => {
  it("say what the week's figures say, each pointing at its chart", () => {
    expect(findings(WEEK)).toEqual([
      { id: "mover", section: "trend", metric: "net", text: "Net sales are up 25.0% on the period before." },
      { id: "busiest", section: "when", text: "Saturday brings 30% of a typical week's sales; the busiest hour is 13:00–14:00." },
      { id: "menu", section: "menu", text: "Sea Bass alone is 54% of revenue." },
      { id: "refunds", section: "refunds", text: "“Long wait” is the most common refund cause, 3 of 5 (£36.00), most of them 13:00–14:00." },
      { id: "repeat", section: "diners", text: "50% of diners had been before, up 10.0 points on the period before." },
      { id: "tables", section: "tables", text: "Window took 60% of net sales." },
    ])
  })

  it("take a weekday as its average day when the range isn't whole weeks", () => {
    // Eight days, Monday to Monday: Monday's sales are spread over two Mondays.
    const eight = { ...WEEK, range: range("2026-10-05", "2026-10-12", 8) }
    expect(findings(eight).find((f) => f.id === "busiest")?.text).toBe("Saturday brings 32% of a typical week's sales; the busiest hour is 13:00–14:00.")
    expect([...weekdayCounts({ from: "2026-10-05", to: "2026-10-12" }).entries()]).toEqual([[1, 2], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [7, 1]])
    expect([...weekdayCounts({ from: "2026-09-13", to: "2026-10-12" }).values()]).toEqual([5, 4, 4, 4, 4, 4, 5])
  })

  it("name the few dishes that make 80% when no dish stands out, and a deleted table", () => {
    const spread = ["m1", "m2", "m3", "m4", "m5", "m6"].map((menuId) => ({ ...WEEK.items[0], menuId, revenue: 100 }))
    expect(findings({ ...WEEK, items: spread }).find((f) => f.id === "menu")?.text).toBe("5 of 6 dishes make 80% of revenue.")
    const deleted = WEEK.tables.map((t) => ({ ...t, name: null }))
    expect(findings({ ...WEEK, tables: deleted }).find((f) => f.id === "tables")?.text).toBe("A table since deleted took 60% of net sales.")
  })

  it("keep silent with too little to draw on, and count the payments still pending", () => {
    const thin: ISalesReport = {
      ...WEEK,
      range: range("2026-10-11", "2026-10-11", 1),
      previous: undefined,
      items: [WEEK.items[0]],
      refunds: { count: 2, byReason: [{ reason: "quality", count: 2, amount: 10 }], byHour: [] },
      totals: totals({ gross: 100, orders: 10, diners: 4, returningDiners: 2, pendingOrders: 1 }),
      tables: [WEEK.tables[0]],
    }
    expect(findings(thin)).toEqual([{ id: "pending", section: "trend", text: "1 payment still awaits the provider and isn't counted." }])
    expect(findings({ ...thin, totals: totals() })).toEqual([])
  })

  it("say a small change is no mover, and refunds with no recorded cause as a sum", () => {
    const flat = { ...WEEK, previous: { ...WEEK.previous!, totals: totals({ gross: 950, net: 920, orders: 95, visits: 80, diners: 20, returningDiners: 10 }) } }
    expect(findings(flat).find((f) => f.id === "mover")).toBeUndefined()
    const unsaid = { ...WEEK, refunds: { ...WEEK.refunds, byReason: [{ reason: null, count: 5, amount: 50 }], byHour: [] } }
    expect(findings(unsaid).find((f) => f.id === "refunds")?.text).toBe("5 refunds came to £50.00, 5.0% of gross sales.")
  })
})

describe("weekdays and hours", () => {
  it("lists the weekdays a range has, Monday first, and names an hour's span", () => {
    expect(weekdaysIn({ from: "2026-10-05", to: "2026-10-11" })).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(weekdaysIn({ from: "2026-10-10", to: "2026-10-12" })).toEqual([1, 6, 7])
    expect(weekdaysIn({ from: "2026-10-11", to: "2026-10-11" })).toEqual([7])
    expect(weekdaysIn({ from: "2026-01-01", to: "2026-12-31" })).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(hourSpan(23)).toBe("23:00–00:00")
  })
})

describe("the sections of the sales page", () => {
  let report: ISalesReport
  beforeEach(() => {
    report = WEEK
    server.use(
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(shop)),
      http.get(`${BASE}/shops/s1/sales`, () => HttpResponse.json(report))
    )
  })
  const open = () => renderWithProviders(<Sales />, { route: "/shop/s1/sales?from=2026-10-05&to=2026-10-11", path: "/shop/:shopId/sales" })

  it("lists the highlights as links to their charts", async () => {
    open()
    const panel = await screen.findByRole("region", { name: "Highlights" })
    const links = within(panel).getAllByRole("link")
    expect(links).toHaveLength(6)
    expect(links[1]).toHaveTextContent("Saturday brings 30% of a typical week's sales; the busiest hour is 13:00–14:00.")
    expect(links[1]).toHaveAttribute("href", "#when")
    expect(document.getElementById("when")).not.toBeNull()
    expect(document.getElementById("trend")).not.toBeNull()
  })

  it("draws the heatmap as a table of the hours with sales, switchable to sales", async () => {
    const { user } = open()
    const when = await screen.findByRole("region", { name: "When you sell" })
    const grid = within(when).getByRole("table")
    const columns = within(grid).getAllByRole("columnheader")
    expect(columns.map((c) => c.textContent)).toEqual(["909:00–10:00", "1010:00–11:00", "1111:00–12:00", "1212:00–13:00", "1313:00–14:00"])
    const rows = within(grid).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(7)
    // The figure drawn in the cell (from tablet widths), then its full text for a screen reader.
    expect(rows[5]).toHaveTextContent("SatSaturdaynonenonenone1515 orders, £150.001515 orders, £150.00")
    expect(rows[5].querySelectorAll("td")[3]).toHaveAttribute("title", "Saturday 12:00–13:00: 15 orders, £150.00")
    expect(rows[5].querySelectorAll("td")[3]).toHaveStyle({ "--heat": "1" })
    expect(rows[0].querySelectorAll("td")[4]).toHaveStyle({ "--heat": "0.6666666666666666" })
    expect(within(when).getByText("Darkest: 15 in an hour")).toBeInTheDocument()

    await user.click(within(when).getByRole("button", { name: "Sales" }))
    expect(within(when).getByText("Darkest: £150.00 in an hour")).toBeInTheDocument()
    expect(within(when).getByText("Sales by weekday and hour, 5 Oct – 11 Oct 2026, 09:00 to 14:00", { selector: "figcaption" })).toBeInTheDocument()
  })

  it("shows a single day's heatmap as one row", async () => {
    report = { ...WEEK, range: range("2026-10-10", "2026-10-10", 1), heatmap: WEEK.heatmap.filter((c) => c.dow === 6) }
    renderWithProviders(<Sales />, { route: "/shop/s1/sales?from=2026-10-10&to=2026-10-10", path: "/shop/:shopId/sales" })
    const when = await screen.findByRole("region", { name: "When you sell" })
    const rows = within(when).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent("SatSaturday")
  })

  it("ranks the menu by revenue, filters it by category and sorts the full table", async () => {
    const { user } = open()
    const menu = await screen.findByRole("region", { name: "What sells" })
    expect(within(menu).getByText("Revenue by dish, 5 Oct – 11 Oct 2026: 2 of 4 make 80%", { selector: "figcaption" })).toBeInTheDocument()

    await user.click(within(menu).getByRole("button", { name: "All items (4)" }))
    const table = within(menu).getByRole("table")
    expect(within(table).getByRole("columnheader", { name: /Revenue/ })).toHaveAttribute("aria-sort", "descending")
    let rows = within(table).getAllByRole("row").slice(1)
    expect(rows.map((r) => r.querySelector("th")?.textContent)).toEqual(["Sea Bass", "Latte", "Soup", "Tea"])
    expect(rows[0]).toHaveTextContent("Sea BassFood£18.00301£540.00")

    await user.click(within(table).getByRole("button", { name: "Units" }))
    rows = within(table).getAllByRole("row").slice(1)
    expect(rows.map((r) => r.querySelector("th")?.textContent)).toEqual(["Latte", "Sea Bass", "Soup", "Tea"])

    await user.click(within(menu).getByRole("button", { name: "Drinks" }))
    expect(within(menu).getByText("Revenue by dish, drinks, 5 Oct – 11 Oct 2026: 1 of 2 make 80%", { selector: "figcaption" })).toBeInTheDocument()
    expect(within(table).getAllByRole("row").slice(1).map((r) => r.querySelector("th")?.textContent)).toEqual(["Latte", "Tea"])
  })

  it("drops a category filter when a period has one category alone", async () => {
    const { user } = open()
    const menu = await screen.findByRole("region", { name: "What sells" })
    await user.click(within(menu).getByRole("button", { name: "Drinks" }))
    expect(within(menu).getByText(/Revenue by dish, drinks/, { selector: "figcaption" })).toBeInTheDocument()

    report = { ...WEEK, range: range("2026-09-28", "2026-10-04", 7), items: WEEK.items.filter((i) => i.category === "food") }
    await user.click(screen.getByRole("button", { name: "Previous 7 days" }))
    const again = await screen.findByText("Revenue by dish, 28 Sept – 4 Oct 2026: 1 of 2 make 80%", { selector: "figcaption" })
    expect(again).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "What sells" })).queryByRole("group", { name: "Category" })).not.toBeInTheDocument()
  })

  it("lists the refunds by cause and, from six of them, by hour, with the amounts", async () => {
    report = { ...WEEK, refunds: { ...WEEK.refunds, count: 6 } }
    open()
    const refunds = await screen.findByRole("region", { name: "Refunds" })
    const [byCause, byHour] = within(refunds).getAllByRole("table")
    expect(within(byCause).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([
      "Long wait3£36.00",
      "Quality issue1£10.00",
      "No reason recorded1£4.00",
    ])
    expect(within(refunds).getByText("Refunds by cause: 6 refunds, £50.00, 5.0% of gross sales, 5 Oct – 11 Oct 2026", { selector: "figcaption" })).toBeInTheDocument()
    expect(within(byHour).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual(["13:00–14:003£36.00", "19:00–20:002£14.00"])
  })

  it("keeps the hours to itself under six refunds", async () => {
    open()
    const refunds = await screen.findByRole("region", { name: "Refunds" })
    expect(within(refunds).getAllByRole("table")).toHaveLength(1)
    expect(within(refunds).queryByRole("figure", { name: "Refunds by hour" })).not.toBeInTheDocument()
  })

  it("says so when there were no refunds", async () => {
    report = { ...WEEK, refunds: { count: 0, byReason: [], byHour: [] }, totals: { ...WEEK.totals, refunds: 0 } }
    open()
    const refunds = await screen.findByRole("region", { name: "Refunds" })
    expect(refunds).toHaveTextContent("No refunds in this period.")
    expect(within(refunds).queryByRole("table")).not.toBeInTheDocument()
  })

  it("splits the diners into new and returning per day, with visits per diner", async () => {
    open()
    const diners = await screen.findByRole("region", { name: "Diners" })
    expect(within(diners).getByText("4.0 visits per diner")).toBeInTheDocument()
    const rows = within(within(diners).getByRole("table")).getAllByRole("row").slice(1)
    expect(rows[0]).toHaveTextContent("Mon 5 Oct400.0%")
    expect(rows[6]).toHaveTextContent("Sun 11 Oct1375.0%")
  })

  it("ranks the tables by net sales, names a deleted one, and splits the takings by payment method", async () => {
    const { user } = open()
    const section = await screen.findByRole("region", { name: "Tables and how they pay" })
    const [tables, mix] = within(section).getAllByRole("table")
    let rows = within(tables).getAllByRole("row").slice(1)
    expect(rows.map((r) => r.textContent)).toEqual(["Window6050£570.00£12.00", "Garden3020£280.00£15.00", "Deleted table1010£100.00£10.00"])

    await user.click(within(tables).getByRole("button", { name: "Per visit" }))
    rows = within(tables).getAllByRole("row").slice(1)
    expect(rows[0]).toHaveTextContent("Garden")
    await user.click(within(tables).getByRole("button", { name: "Table" }))
    rows = within(tables).getAllByRole("row").slice(1)
    expect(rows.map((r) => r.querySelector("th")?.textContent)).toEqual(["Deleted table", "Garden", "Window"])

    expect(within(section).getByText("Gross sales by payment method by day, 5 Oct – 11 Oct 2026: PayPal 40.0% (40 orders), card 60.0% (60 orders)", { selector: "figcaption" })).toBeInTheDocument()
    expect(within(mix).getAllByRole("row")[6]).toHaveTextContent("Sat 10 Oct£120.00£180.00")
  })

  it("opens four more figures behind More figures", async () => {
    const { user } = open()
    const figures = await screen.findByRole("list", { name: "Headline figures" })
    expect(within(figures).getAllByRole("listitem")).toHaveLength(5)
    await user.click(screen.getByRole("button", { name: "More figures" }))
    const cards = within(figures).getAllByRole("listitem")
    expect(cards).toHaveLength(9)
    expect(cards[5]).toHaveTextContent("Gross sales£1,000.00▲ up 25.0% on the period before")
    expect(cards[7]).toHaveTextContent("Visits80no change on the period before")
    expect(screen.getByRole("button", { name: "Fewer figures" })).toHaveAttribute("aria-expanded", "true")
  })
})
