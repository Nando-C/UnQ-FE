import { describe, it, expect, beforeEach, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import Sales from "../components/Shops/Sales/Sales"
import TrendChart from "../components/Shops/Sales/TrendChart"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import {
  addDays,
  buildSalesSearch,
  changeOf,
  daysBetween,
  formatRange,
  groupByFor,
  metricOf,
  monthStart,
  movingAverage,
  parseSalesSearch,
  presetOf,
  presetRange,
  stepRange,
  todayIn,
  weekStart,
} from "../lib/sales"
import { bucket, range, shop, totals } from "./salesFixtures"
import type { ISalesReport } from "../typings/sales"

// The sales page: its arithmetic in the shop's days, and the page over a
// report msw answers (what the API's GET /shops/:shopId/sales gives).

// A week of sales with the week before for comparison.
const WEEK: ISalesReport = {
  range: range("2026-10-05", "2026-10-11", 7),
  totals: totals({ gross: 700, refunds: 14, net: 686, orders: 50, pendingOrders: 2, visits: 40, diners: 30, returningDiners: 12, units: 120 }),
  series: [100, 90, 110, 0, 130, 150, 120].map((gross, i) =>
    bucket(addDays("2026-10-05", i), { gross, net: gross - (i === 4 ? 14 : 0), refunds: i === 4 ? 14 : 0, orders: gross ? 7 + i : 0, visits: gross ? 6 : 0 })),
  heatmap: [], items: [], refunds: { count: 1, byReason: [], byHour: [] }, tables: [],
  previous: {
    range: range("2026-09-28", "2026-10-04", 7),
    totals: totals({ gross: 600, refunds: 6, net: 594, orders: 48, visits: 40, diners: 30, returningDiners: 9, units: 100 }),
    series: [80, 80, 90, 90, 90, 90, 80].map((gross, i) => bucket(addDays("2026-09-28", i), { gross, net: gross, orders: 6 })),
  },
}
const EMPTY = (from: string, to: string): ISalesReport => ({
  range: range(from, to, daysBetween(from, to)),
  totals: totals(), series: Array.from({ length: daysBetween(from, to) }, (_, i) => bucket(addDays(from, i))),
  heatmap: [], items: [], refunds: { count: 0, byReason: [], byHour: [] }, tables: [],
})

describe("days in the shop's zone", () => {
  it("knows today where the shop is, not where the browser is", () => {
    const lateEvening = new Date("2026-03-29T23:30:00Z") // 00:30 BST on the 30th
    expect(todayIn("Europe/London", lateEvening)).toBe("2026-03-30")
    expect(todayIn("America/New_York", lateEvening)).toBe("2026-03-29")
    expect(todayIn("Nowhere/Here", lateEvening)).toBe("2026-03-30")
  })

  it("builds the presets from today, weeks from Monday, and names a range that is one", () => {
    const today = "2026-10-11" // a Sunday
    expect(presetRange("today", today)).toEqual({ from: today, to: today })
    expect(presetRange("week", today)).toEqual({ from: "2026-10-05", to: today })
    expect(presetRange("last30", today)).toEqual({ from: "2026-09-12", to: today })
    expect(presetRange("month", today)).toEqual({ from: "2026-10-01", to: today })
    expect(weekStart("2026-10-05")).toBe("2026-10-05")
    expect(presetOf({ from: "2026-09-12", to: today }, today)).toBe("last30")
    expect(presetOf({ from: "2026-09-13", to: today }, today)).toBeNull()
  })

  it("steps a range by its own length, and a month by whole months across the year end", () => {
    expect(stepRange({ from: "2026-10-05", to: "2026-10-11" }, -1)).toEqual({ from: "2026-09-28", to: "2026-10-04" })
    expect(stepRange({ from: "2026-10-05", to: "2026-10-11" }, 1)).toEqual({ from: "2026-10-12", to: "2026-10-18" })
    expect(stepRange({ from: "2026-01-01", to: "2026-01-11" }, -1, { unit: "month" })).toEqual({ from: "2025-12-01", to: "2025-12-31" })
    expect(stepRange({ from: "2026-10-05", to: "2026-10-07" }, -1, { unit: "week" })).toEqual({ from: "2026-09-28", to: "2026-10-04" })
    expect(stepRange({ from: "2025-09-01", to: "2025-09-30" }, 1, { today: "2025-10-12" })).toEqual({ from: "2025-10-01", to: "2025-10-12" })
    expect(stepRange({ from: "2026-01-01", to: "2026-01-11" }, -1)).toEqual({ from: "2025-12-21", to: "2025-12-31" })
    expect(stepRange({ from: "2026-10-01", to: "2026-10-01" }, -1)).toEqual({ from: "2026-09-30", to: "2026-09-30" })
    expect(stepRange({ from: "2026-01-01", to: "2026-03-31" }, -1)).toEqual({ from: "2025-10-01", to: "2025-12-31" })
    expect(stepRange({ from: "2026-01-01", to: "2026-03-31" }, 1)).toEqual({ from: "2026-04-01", to: "2026-06-30" })
    expect(stepRange({ from: "2026-02-01", to: "2026-02-28" }, 1)).toEqual({ from: "2026-03-01", to: "2026-03-31" })
    expect(stepRange({ from: "2026-01-30", to: "2026-01-31" }, 1)).toEqual({ from: "2026-02-01", to: "2026-02-02" })
  })

  it("mirrors the API's grouping default and formats a range", () => {
    expect(groupByFor({ from: "2026-01-01", to: "2026-04-02" })).toBe("day")
    expect(groupByFor({ from: "2026-01-01", to: "2026-04-03" })).toBe("week")
    expect(formatRange({ from: "2026-09-12", to: "2026-10-11" })).toBe("12 Sept – 11 Oct 2026")
    expect(formatRange({ from: "2025-12-29", to: "2026-01-04" })).toBe("29 Dec 2025 – 4 Jan 2026")
    expect(formatRange({ from: "2026-10-11", to: "2026-10-11" })).toBe("11 Oct 2026")
  })

  it("keeps the view in the URL and falls back to the last 30 days", () => {
    const today = "2026-10-11"
    expect(parseSalesSearch(new URLSearchParams(""), today)).toEqual({ from: "2026-09-12", to: today, metric: "net" })
    expect(parseSalesSearch(new URLSearchParams("from=2026-10-01&to=2026-09-01"), today)).toMatchObject({ from: "2026-09-12", to: today })
    const state = parseSalesSearch(new URLSearchParams("from=2026-10-01&to=2026-10-11&by=week&metric=refundRate&compare=0&avg=1"), today)
    expect(state).toEqual({ from: "2026-10-01", to: "2026-10-11", by: "week", metric: "refundRate", compare: false, average: true })
    expect(buildSalesSearch(state).toString()).toBe("from=2026-10-01&to=2026-10-11&by=week&metric=refundRate&compare=0&avg=1")
    expect(buildSalesSearch({ from: "2026-10-01", to: "2026-10-11", metric: "net" }).toString()).toBe("from=2026-10-01&to=2026-10-11")
  })
})

describe("metrics", () => {
  it("derives the ratios and never divides by nothing", () => {
    const t = totals({ gross: 200, refunds: 10, orders: 8, visits: 5 })
    expect(metricOf("avgOrder", t)).toBe(25)
    expect(metricOf("avgVisit", t)).toBe(40)
    expect(metricOf("refundRate", t)).toBe(0.05)
    expect(metricOf("avgOrder", totals())).toBe(0)
    expect(metricOf("refundRate", totals())).toBe(0)
  })

  it("averages over the last seven points once there are seven", () => {
    expect(movingAverage([7, 7, 7, 7, 7, 7, 7, 14], 7)).toEqual([null, null, null, null, null, null, 7, 8])
    expect(movingAverage([1, 2], 7)).toEqual([null, null])
  })

  it("says the change as a percentage, or in points for a rate", () => {
    expect(changeOf(108.1, 100, "money")).toEqual({ direction: "up", text: "8.1%" })
    expect(changeOf(90, 100, "count")).toEqual({ direction: "down", text: "10.0%" })
    expect(changeOf(100, 100, "money")).toEqual({ direction: "same", text: "no change" })
    expect(changeOf(100.01, 100, "money")).toEqual({ direction: "same", text: "no change" })
    expect(changeOf(5, 0, "count")).toBeNull()
    expect(changeOf(120, -30, "money")).toEqual({ direction: "up", text: "from -£30.00" })
    expect(changeOf(0, 0, "money")).toEqual({ direction: "same", text: "no change" })
    expect(changeOf(0.023, 0.019, "percent")).toEqual({ direction: "up", text: "0.4 pt" })
  })
})

describe("the sales page", () => {
  const requests: URL[] = []
  beforeEach(() => {
    requests.length = 0
    server.use(
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(shop)),
      http.get(`${BASE}/shops/s1/sales`, ({ request }) => {
        const url = new URL(request.url)
        requests.push(url)
        const from = url.searchParams.get("from")!
        const to = url.searchParams.get("to")!
        if (from === "2026-10-05" && to === "2026-10-11") return HttpResponse.json(url.searchParams.get("compare") ? WEEK : { ...WEEK, previous: undefined })
        return HttpResponse.json(EMPTY(from, to))
      })
    )
  })
  const open = (search = "?from=2026-10-05&to=2026-10-11") =>
    renderWithProviders(<Sales />, { route: `/shop/s1/sales${search}`, path: "/shop/:shopId/sales" })

  it("shows the headline figures with their change on the period before, and the trend of the metric", async () => {
    open()

    const figures = await screen.findByRole("list", { name: "Headline figures" })
    const cards = within(figures).getAllByRole("listitem")
    expect(cards).toHaveLength(5)
    expect(cards[0]).toHaveTextContent("Net sales£686.00▲ up 15.5% on the period before")
    expect(cards[1]).toHaveTextContent("Orders50▲ up 4.2% on the period before2 awaiting the provider")
    expect(cards[2]).toHaveTextContent("Average order£14.00▲ up 12.0% on the period before")
    expect(cards[3]).toHaveTextContent("Refund rate2.0%▲ up 1.0 pt on the period before")
    expect(cards[3].querySelector(".kpi-delta")).toHaveClass("bad")
    expect(cards[4]).toHaveTextContent("Returning diners40.0%▲ up 10.0 pt on the period before12 of 30")

    // One request, with the comparison the range's length turns on.
    expect(requests).toHaveLength(1)
    expect(Object.fromEntries(requests[0].searchParams)).toEqual({ from: "2026-10-05", to: "2026-10-11", by: "day", compare: "previous" })

    // The chart draws, and its numbers are in the table.
    expect(document.querySelector(".recharts-surface")).not.toBeNull()
    const table = within(screen.getByRole("figure", { name: "Trend" })).getByRole("table")
    expect(within(table).getByRole("columnheader", { name: "Net sales" })).toBeInTheDocument()
    expect(within(table).getByRole("columnheader", { name: "Period before" })).toBeInTheDocument()
    const rows = within(table).getAllByRole("row").slice(1)
    expect(rows).toHaveLength(7)
    expect(rows[0]).toHaveTextContent("Mon 5 Oct£100.00£80.00")
    expect(rows[3]).toHaveTextContent("Thu 8 Oct£0.00£90.00")
    expect(screen.getByText("Net sales by day, 5 Oct – 11 Oct 2026, against 28 Sept – 4 Oct 2026", { selector: "figcaption" })).toBeInTheDocument()
    expect(document.title).toBe("Sales · Cafe · UnQ")
  })

  it("switches the metric without another request, and keeps it in the URL", async () => {
    const { user } = open()
    await screen.findByRole("list", { name: "Headline figures" })

    await user.selectOptions(screen.getByRole("combobox", { name: "Metric" }), "orders")

    const table = within(screen.getByRole("figure", { name: "Trend" })).getByRole("table")
    expect(within(table).getByRole("columnheader", { name: "Orders" })).toBeInTheDocument()
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Mon 5 Oct76")
    expect(requests).toHaveLength(1)
  })

  it("draws the period before by day only, the headline changes whatever the grouping", () => {
    const weekly: ISalesReport = {
      ...WEEK,
      range: { ...WEEK.range, by: "week", days: 7 },
      series: [bucket("2026-10-05", { gross: 700, net: 686, orders: 50 })],
      previous: { ...WEEK.previous!, range: { ...WEEK.previous!.range, by: "week" }, series: [bucket("2026-09-28", { gross: 600, net: 594, orders: 48 })] },
    }
    renderWithProviders(<TrendChart report={weekly} metricKey="net" onMetric={() => {}} average={false} onAverage={() => {}} />)
    expect(screen.getByText("Net sales by week, 5 Oct – 11 Oct 2026", { selector: "figcaption" })).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "Period before" })).not.toBeInTheDocument()
  })

  it("offers the 7-day average only from a week of days, off under two weeks", async () => {
    open()
    await screen.findByRole("list", { name: "Headline figures" })

    const average = screen.getByRole("checkbox", { name: "7-day average" })
    expect(average).not.toBeChecked()
    expect(screen.queryByRole("columnheader", { name: "7-day average" })).not.toBeInTheDocument()
  })

  it("steps to the period before, asking again with the new range in the URL", async () => {
    const { user } = open()
    await screen.findByRole("list", { name: "Headline figures" })

    await user.click(screen.getByRole("button", { name: "Previous period" }))

    await waitFor(() => expect(requests).toHaveLength(2))
    expect(Object.fromEntries(requests[1].searchParams)).toEqual({ from: "2026-09-28", to: "2026-10-04", by: "day", compare: "previous" })
    expect(await screen.findByText("No sales between 28 Sept – 4 Oct 2026.")).toBeInTheDocument()
    expect(screen.queryByRole("list", { name: "Headline figures" })).not.toBeInTheDocument()
    expect(screen.getByText("28 Sept – 4 Oct 2026 · 7 days · days in Europe/London")).toBeInTheDocument()
  })

  it("groups by week when asked, and turns the comparison off", async () => {
    const { user } = open()
    await screen.findByRole("list", { name: "Headline figures" })

    await user.selectOptions(screen.getByRole("combobox", { name: "Group by" }), "week")
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1].searchParams.get("by")).toBe("week")

    await user.click(screen.getByRole("checkbox", { name: "Compare with the 7 days before" }))
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests[2].searchParams.get("compare")).toBeNull()
  })

  it("defaults to the last 30 days in the shop's zone, with the chips saying which", async () => {
    open("")
    await screen.findByText(/No sales between/)

    const today = todayIn("Europe/London")
    expect(Object.fromEntries(requests[0].searchParams)).toEqual({ from: addDays(today, -29), to: today, by: "day", compare: "previous" })
    expect(screen.getByRole("button", { name: "Last 30 days" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Next period" })).toBeDisabled()
  })

  it("asks again when the range changes while the period includes today", async () => {
    const today = todayIn("Europe/London")
    const { user } = open(`?from=${addDays(today, -6)}&to=${today}`)
    await screen.findByText(/No sales between/)
    expect(requests).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Last 30 days" }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1].searchParams.get("from")).toBe(addDays(today, -29))
  })

  it("says why a download failed, in the API's words", async () => {
    server.use(http.get(`${BASE}/shops/s1/sales/export`, () => HttpResponse.json({ message: "Validation failed", details: [{ path: "to", message: "Before `from`" }] }, { status: 400 })))
    const { user } = open()
    await screen.findByRole("list", { name: "Headline figures" })

    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    await user.click(screen.getByRole("button", { name: "Days · one row per day" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't download the file: Before `from`")
  })

  it("steps forward from last month to this month so far", async () => {
    const today = todayIn("Europe/London")
    const lastMonth = stepRange({ from: monthStart(today), to: today }, -1, { unit: "month" })
    const { user } = open(`?from=${lastMonth.from}&to=${lastMonth.to}`)
    await screen.findByText(/No sales between/)

    await user.click(screen.getByRole("button", { name: "Next period" }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1].searchParams.get("from")).toBe(monthStart(today))
    expect(requests[1].searchParams.get("to")).toBe(today)
    expect(screen.getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true")
  })

  it("downloads a CSV through the API client and saves it under the API's file name", async () => {
    server.use(
      http.get(`${BASE}/shops/s1/sales/export`, ({ request }) => {
        const url = new URL(request.url)
        return new HttpResponse("\uFEFFItem,Units\r\n", {
          headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename=cafe-sales-${url.searchParams.get("from")}-${url.searchParams.get("to")}-${url.searchParams.get("table")}.csv` },
        })
      })
    )
    const saved: { href: string; download: string }[] = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push({ href: this.href, download: this.download })
    })
    const createObjectURL = vi.fn(() => "blob:csv")
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const { user } = open()
    await screen.findByRole("list", { name: "Headline figures" })

    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    await user.click(screen.getByRole("button", { name: "Items · one row per dish" }))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toEqual({ href: "blob:csv", download: "cafe-sales-2026-10-05-2026-10-11-items.csv" })
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:csv"), { timeout: 15_000 })
    click.mockRestore()
  })

  it("shows the API's message with a way to try again when the report can't be loaded", async () => {
    server.use(http.get(`${BASE}/shops/s1/sales`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }), { once: true }))
    const { user } = open()

    expect(await screen.findByText("Couldn't load the sales report: Generic Server Error")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("list", { name: "Headline figures" })).toBeInTheDocument()
  })

  it("says how the figures are counted, and offers the period's tables as CSV files", async () => {
    const { user } = open()
    await screen.findByRole("list", { name: "Headline figures" })

    await user.click(screen.getByRole("button", { name: "How these are counted" }))
    const note = await screen.findByRole("tooltip")
    expect(note).toHaveTextContent("Days are the shop's, in Europe/London; weeks start on Monday.")
    expect(note).toHaveTextContent("Refunds count on the day they were made")

    await user.click(screen.getByRole("button", { name: "Download CSV" }))
    expect(screen.getAllByRole("button", { name: /· one row per/ }).map((b) => b.textContent)).toEqual([
      "Orders · one row per payment",
      "Items · one row per dish",
      "Days · one row per day",
    ])
  })

  it("shows the page's shape while the shop and the report load", () => {
    open()
    expect(screen.getByRole("status")).toHaveTextContent("Loading the sales report")
  })
})
