import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import TableList from "../components/Tables/TableList/TableList"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"
import type { IPayback, ITableCarts } from "../typings/tables"
import { ATTENTION_LABEL, LOG_ACTION_LABEL, dateTime } from "../lib/tables"

vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update() {}
  },
}))

const shop = {
  _id: "s1", name: "Cafe", menu: [],
  tables: [{ _id: "t4", name: "4", Qr_Url: "https://x/t4" }],
} as unknown as IShop

const ada = { _id: "u1", name: "Ada" }
const sam = { _id: "mg1", name: "Sam" }
// 3 Oct, 14:05, local time.
const OCT_3 = new Date(2026, 9, 3, 14, 5).toISOString()

// Ada is owed £6 from her card payment pi_1, which Stripe won't refund.
const payback = (over: Partial<IPayback> = {}): IPayback => ({
  _id: "pb1", shopId: "s1", tableId: "t4", cartId: "c1", kind: "refundRefused",
  userId: ada, amount: 6, currency: "GBP", paymentIntentId: "pi_1", owed: true, at: new Date().toISOString(),
  ...over,
})
// Marked done by Sam on 3 Oct, as `doneAs`.
const done = (doneAs: IPayback["doneAs"], over: Partial<IPayback> = {}) =>
  payback({ owed: undefined, doneAt: OCT_3, doneByUserId: sam, doneAs, ...over })

let carts: ITableCarts
let marks: { url: string; body: unknown }[]
let markAnswer: () => Response

beforeEach(() => {
  carts = { open: [], recentlyClosed: [], paybacks: [payback()] }
  marks = []
  markAnswer = () => HttpResponse.json({ payback: done("paidBack") })
  server.use(
    http.get(`${BASE}/shops/s1/tables/status`, () =>
      HttpResponse.json([{ tableId: "t4", name: "4", state: "free", owed: 0, paid: 0, attention: ["payBack"] }])
    ),
    http.get(`${BASE}/shops/s1/tables/t4/carts`, () => HttpResponse.json(carts)),
    http.post(`${BASE}/shops/s1/paybacks/:paybackId/done`, async ({ request }) => {
      marks.push({ url: request.url, body: await request.json() })
      return markAnswer()
    })
  )
})

const openSheet = async () => {
  const utils = renderWithProviders(<TableList shopId="s1" />, {
    preloadedState: { shops: { data: [shop], selected: shop, selectedMenu: null } },
  })
  await utils.user.click(screen.getByRole("button", { name: "View table 4" }))
  const sheet = await screen.findByRole("dialog")
  await within(sheet).findByText("No open cart: this table is free.")
  return { ...utils, sheet }
}
// The section's list of what's owed, and of what was marked done.
const owedList = (sheet: HTMLElement) => within(sheet).getByRole("list", { name: "Owed" })
const doneList = (sheet: HTMLElement) => within(sheet).getByRole("list", { name: "Done in the last 30 days" })
// The confirmation's own button, in the sheet's footer.
const confirmButton = (sheet: HTMLElement, name: string) =>
  within(sheet.querySelector(".modal-footer") as HTMLElement).getByRole("button", { name })

describe("what's owed, on the table sheet", () => {
  it.each([
    [
      "a refund Stripe refused",
      payback(),
      "Pay back £6.00 to Ada (payment pi_1): Stripe won't refund it. Not if a cart shows it as paid and they didn't pay again, or Stripe's dashboard shows they've disputed it since (their bank returns it then).",
      "Mark paid back",
    ],
    [
      "a manager's refund that failed later",
      payback({ kind: "refundFailed", amount: 3, paymentAmount: 6 }),
      "£3.00 refund to Ada failed at Stripe: pay them back another way, unless Stripe's dashboard shows they've disputed it since.",
      "Mark paid back",
    ],
    [
      "a refused refund a cart shows as paid",
      payback({ recorded: true }),
      "Stripe won't refund £6.00 to Ada (payment pi_1), but a cart shows it as paid: check that payment on this sheet first (did they pay again? was it refunded since?), and that Stripe's dashboard shows no dispute since.",
      "Mark checked",
    ],
    [
      "a disputed hand-over",
      payback({ disputed: true }),
      "Ada disputes £6.00 with their bank (payment pi_1): don't pay them back yourselves. Accept the dispute in Stripe's dashboard (don't contest it), and their bank returns it. If it closes without the money going back to them, pay them back another way.",
      "Mark handled",
    ],
    [
      "a disputed hand-over a cart shows as paid (the dispute first)",
      payback({ disputed: true, recorded: true }),
      "Ada disputes £6.00 with their bank (payment pi_1): don't pay them back yourselves. Accept the dispute in Stripe's dashboard (don't contest it), and their bank returns it. If it closes without the money going back to them, pay them back another way. A cart shows it as paid.",
      "Mark handled",
    ],
    [
      "a manager's refund the diner disputes",
      payback({ kind: "refundFailed", amount: 3, paymentAmount: 6, disputed: true }),
      "A £3.00 refund to Ada couldn't be made: they dispute the whole £6.00 payment with their bank (payment pi_1). Don't pay the £3.00 back yourselves: if you accept the dispute, their bank returns all £6.00; if you contest it and win, pay the £3.00 back another way.",
      "Mark handled",
    ],
    [
      "one to a diner whose account is gone",
      payback({ userId: null }),
      "Pay back £6.00 to a diner whose account is gone (payment pi_1): Stripe won't refund it. Not if a cart shows it as paid and they didn't pay again, or Stripe's dashboard shows they've disputed it since (their bank returns it then).",
      "Mark paid back",
    ],
    [
      "a dispute by a diner whose account is gone",
      payback({ userId: null, disputed: true }),
      "A diner whose account is gone disputes £6.00 with their bank (payment pi_1): don't pay them back yourselves. Accept the dispute in Stripe's dashboard (don't contest it), and their bank returns it. If it closes without the money going back to them, pay them back another way.",
      "Mark handled",
    ],
  ])("says what to do about %s, with its button", async (_, owed, text, button) => {
    carts = { open: [], recentlyClosed: [], paybacks: [owed] }
    const { sheet } = await openSheet()

    const list = owedList(sheet)
    expect(within(sheet).getByRole("heading", { name: "To pay back" })).toBeInTheDocument()
    expect(within(list).getByText(text)).toBeInTheDocument()
    expect(within(list).getByRole("button", { name: button })).toBeInTheDocument()
  })

  it("shows no section for a table with none", async () => {
    carts = { open: [], recentlyClosed: [] }
    const { sheet } = await openSheet()

    expect(within(sheet).queryByRole("heading", { name: "To pay back" })).not.toBeInTheDocument()
  })
})

describe("marking a pay-back done", () => {
  it("asks first, sends what the manager saw, says what was stored, and moves it to the done ones", async () => {
    const { user, sheet } = await openSheet()
    await user.click(within(owedList(sheet)).getByRole("button", { name: "Mark paid back" }))
    expect(
      within(sheet).getByText("Mark the £6.00 pay-back to Ada as paid back? Do this once you've paid them back another way.")
    ).toBeInTheDocument()
    expect(marks).toEqual([])
    carts = { open: [], recentlyClosed: [], paybacks: [done("paidBack")] }

    await user.click(confirmButton(sheet, "Mark paid back"))

    expect(await within(sheet).findByText("Marked paid back.")).toBeInTheDocument()
    expect(marks).toEqual([{ url: expect.stringContaining("/shops/s1/paybacks/pb1/done"), body: { as: "paidBack" } }])
    await waitFor(() => expect(within(sheet).queryByRole("list", { name: "Owed" })).not.toBeInTheDocument())
    expect(within(doneList(sheet)).getByText("Paid back £6.00 to Ada · marked by Sam, 3 Oct 14:05")).toBeInTheDocument()
  })

  it.each([
    ["handled", payback({ disputed: true }), "Mark handled"],
    ["checked", payback({ recorded: true }), "Mark checked"],
  ] as const)("sends %s for one that calls for it", async (as, owed, button) => {
    carts = { open: [], recentlyClosed: [], paybacks: [owed] }
    markAnswer = () => HttpResponse.json({ payback: done(as) })
    const { user, sheet } = await openSheet()
    await user.click(within(owedList(sheet)).getByRole("button", { name: button }))

    await user.click(confirmButton(sheet, button))

    expect(await within(sheet).findByText(`Marked ${as}.`)).toBeInTheDocument()
    expect(marks.map((m) => m.body)).toEqual([{ as }])
  })

  it("says what another manager marked it as, when they marked it first", async () => {
    markAnswer = () => HttpResponse.json({ payback: done("checked") })
    const { user, sheet } = await openSheet()
    await user.click(within(owedList(sheet)).getByRole("button", { name: "Mark paid back" }))

    await user.click(confirmButton(sheet, "Mark paid back"))

    expect(await within(sheet).findByText("Marked checked.")).toBeInTheDocument()
  })

  it("says it changed, once, and shows it again, when the BE refuses it as changed", async () => {
    markAnswer = () => HttpResponse.json({ message: "This pay-back changed: here it is again" }, { status: 409 })
    const { user, sheet } = await openSheet()
    await user.click(within(owedList(sheet)).getByRole("button", { name: "Mark paid back" }))
    carts = { open: [], recentlyClosed: [], paybacks: [payback({ recorded: true })] }

    await user.click(confirmButton(sheet, "Mark paid back"))

    expect(
      await within(sheet).findByText("This pay-back changed while you were looking: here it is again. Check it before trying again.")
    ).toBeInTheDocument()
    expect(await within(owedList(sheet)).findByRole("button", { name: "Mark checked" })).toBeInTheDocument()
  })
})

describe("pay-backs marked done", () => {
  it.each([
    ["paid back", done("paidBack"), "Paid back £6.00 to Ada · marked by Sam, 3 Oct 14:05"],
    ["a dispute handled", done("handled", { disputed: true }), "Dispute of £6.00 handled for Ada · marked by Sam, 3 Oct 14:05"],
    ["one checked", done("checked"), "Checked £6.00 shown as paid for Ada · marked by Sam, 3 Oct 14:05"],
    [
      "one whose diner and manager are gone",
      done("paidBack", { userId: null, doneByUserId: null }),
      "Paid back £6.00 to a diner whose account is gone · marked by a manager, 3 Oct 14:05",
    ],
  ])("says %s, by who and when", async (_, marked, text) => {
    carts = { open: [], recentlyClosed: [], paybacks: [marked] }
    const { sheet } = await openSheet()

    expect(within(doneList(sheet)).getByText(text)).toBeInTheDocument()
    expect(within(sheet).queryByRole("list", { name: "Owed" })).not.toBeInTheDocument()
    expect(within(sheet).getByText("Nothing owed now.")).toBeInTheDocument()
  })
})

describe("pay-back labels", () => {
  it("flags the table, and labels a pay-back's line in a cart's log", () => {
    expect(ATTENTION_LABEL.payBack).toBe("Diner to pay back")
    expect(LOG_ACTION_LABEL.paybackDone).toBe("Pay-back done")
  })

  it("dates a done one, with the time alone when it's today", () => {
    const now = new Date(2026, 9, 8, 18, 0)
    expect(dateTime(OCT_3, now)).toBe("3 Oct 14:05")
    expect(dateTime(new Date(2026, 9, 8, 9, 30).toISOString(), now)).toBe("09:30")
  })
})
