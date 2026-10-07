import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import TableList from "../components/Tables/TableList/TableList"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"
import type { IMenu } from "../typings/menu"
import type { IManagerCart, IManagerLogEntry, IPayment, ITableCarts } from "../typings/tables"
import { ATTENTION_LABEL } from "../lib/tables"
import { providerName } from "../lib/providers"

vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update() {}
  },
}))

const latte: IMenu = { _id: "m1", name: "Latte", price: 3, available: true, image: "", short_description: "", description: "", category: "drinks" }
const shop = {
  _id: "s1", name: "Cafe", menu: [],
  tables: [{ _id: "t4", name: "4", Qr_Url: "https://x/t4" }],
} as unknown as IShop

// Ada paid £6 by card for 2 Lattes.
const cardPayment = (over: Partial<IPayment> = {}): IPayment => ({
  _id: "p1", provider: "stripe", providerCheckoutId: "pi_1", providerPaymentId: "ch_1", currency: "GBP",
  userId: { _id: "u1", name: "Ada" }, paidAt: new Date().toISOString(), amount: 6,
  lines: [{ menuId: "m1", name: "Latte", qty: 2, unitPrice: 3, refundedQty: 0 }],
  ...over,
})
const cartWith = (over: Partial<IManagerCart> = {}): IManagerCart => ({
  _id: "c1", tableId: "t4", status: "open",
  items: [{ _id: "i1", menuId: latte, qty: 2, qtyPayed: 2 }],
  split: [],
  payments: [cardPayment()],
  refunds: [],
  ...over,
})
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString()

let carts: ITableCarts

beforeEach(() => {
  carts = { open: [cartWith()], recentlyClosed: [] }
  server.use(
    http.get(`${BASE}/shops/s1/tables/status`, () =>
      HttpResponse.json([{ tableId: "t4", name: "4", state: "partlyPaid", owed: 0, paid: 6, attention: [] }])
    ),
    http.get(`${BASE}/shops/s1/tables/t4/carts`, () => HttpResponse.json(carts))
  )
})

const openSheet = async () => {
  const utils = renderWithProviders(<TableList shopId="s1" />, {
    preloadedState: { shops: { data: [shop], selected: shop, selectedMenu: null } },
  })
  await utils.user.click(screen.getByRole("button", { name: "View table 4" }))
  const sheet = await screen.findByRole("dialog")
  await within(sheet).findAllByText("Payments")
  return { ...utils, sheet }
}

describe("a card payment on the table sheet", () => {
  it("names Stripe for one it hasn't confirmed, and when checking it", async () => {
    carts = { open: [cartWith({ payments: [cardPayment({ status: "pending" })] })], recentlyClosed: [] }
    const { user, sheet } = await openSheet()

    expect(within(sheet).getByText(/^Awaiting Stripe/)).toHaveTextContent(
      "Awaiting Stripe: it took this payment but hasn't confirmed it. The items are held as paid until then."
    )
    await user.click(within(sheet).getByRole("button", { name: "Check Ada's payment of £6.00 with Stripe" }))

    expect(
      within(sheet).getByText(
        "Check Ada's payment of £6.00 with Stripe? If Stripe confirmed it, it's recorded as paid. If Stripe declined it, nothing was taken and its items become unpaid again. Ada will see a note either way."
      )
    ).toBeInTheDocument()
  })

  it("names Stripe for one that didn't go through and for a refund in progress", async () => {
    carts = {
      open: [
        cartWith({
          payments: [cardPayment({ _id: "p0", status: "failed" }), cardPayment()],
          refunds: [{ _id: "r1", paymentId: "p1", lines: [{ menuId: "m1", name: "Latte", qty: 1 }], amount: 3, currency: "GBP", status: "pending", at: at(1) }],
        }),
      ],
      recentlyClosed: [],
    }
    const { sheet } = await openSheet()

    expect(within(sheet).getByText("Didn't go through at Stripe: nothing was taken.")).toBeInTheDocument()
    expect(within(sheet).getByText(/^Refund of £3.00 in progress/)).toHaveTextContent("Refund of £3.00 in progress: Stripe hasn't confirmed it.")
  })

  it("says Stripe returns a refund to the diner's card", async () => {
    const { user, sheet } = await openSheet()
    await user.click(within(sheet).getByRole("button", { name: "Refund items from Ada's payment of £6.00" }))
    const picker = within(sheet).getByRole("group", { name: "Choose what to refund" })
    await user.click(within(picker).getByRole("button", { name: "Refund one more Latte" }))
    await user.selectOptions(within(sheet).getByRole("combobox", { name: "Reason" }), "Wrong item served")

    await user.click(within(picker).getByRole("button", { name: "Review refund" }))

    expect(
      within(sheet).getByText(
        "Refund £3.00 to Ada for 1× Latte? Reason: Wrong item served. Stripe returns it to their card, the items are removed from the table's cart, and Ada will see a note. This can't be undone."
      )
    ).toBeInTheDocument()
  })

  it("points to Stripe for a payment it can't refund itself", async () => {
    carts = { open: [cartWith({ payments: [cardPayment({ providerPaymentId: undefined })] })], recentlyClosed: [] }
    const { sheet } = await openSheet()

    expect(within(sheet).getByText("Refund this payment from Stripe.")).toBeInTheDocument()
  })
})

describe("a provider's name", () => {
  it("names the known ones, and any other as recorded, capitalised to start a sentence", () => {
    expect([providerName("paypal"), providerName("stripe"), providerName("adyen"), providerName(undefined)]).toEqual([
      "PayPal", "Stripe", "Adyen", "Payment provider",
    ])
  })
})

describe("the table's status label", () => {
  it("says a payment awaits confirmation, whichever provider has it", () => {
    expect(ATTENTION_LABEL.paymentPending).toBe("Payment awaiting confirmation")
  })
})

describe("a cart's log on the table sheet", () => {
  const line = (over: Partial<IManagerLogEntry>): IManagerLogEntry => ({
    at: at(10), action: "releaseSelection", details: "Ada: 1× Latte", byUserId: { _id: "mg1", name: "Sam" }, ...over,
  })
  const payBack =
    "£6.00 card payment by Ada: Stripe won't refund it, so they were charged (payment pi_1). Pay them back another way, unless a cart shows this payment as paid and they didn't pay again, or Stripe's dashboard shows they've disputed it since (their bank returns it then)."

  it("names the line the sweep writes when it finishes a card payment the diner left", async () => {
    carts = {
      open: [cartWith({ managerLog: [line({ action: "stripeFinished", details: "£6.00 recorded (payment pi_1)", byUserId: undefined })] })],
      recentlyClosed: [],
    }
    const { sheet } = await openSheet()

    expect(within(sheet).getByText("Card payment finished: £6.00 recorded (payment pi_1)")).toBeInTheDocument()
  })

  it("lists what managers and UnQ did, newest first, marking what staff must act on", async () => {
    carts = {
      open: [
        cartWith({
          managerLog: [
            line({ at: at(30) }),
            line({ at: at(20), action: "close", details: "nothing unpaid", byUserId: null }),
            line({ at: at(5), action: "stripeRefundFailed", details: payBack, byUserId: undefined }),
          ],
        }),
      ],
      recentlyClosed: [],
    }
    const { sheet } = await openSheet()

    const items = within(within(sheet).getByRole("heading", { name: "Log" }).nextElementSibling as HTMLElement).getAllByRole("listitem")
    expect(items.map((li) => li.textContent?.replace(/^\S+ · /, ""))).toEqual([
      `UnQAction needed: ${payBack}`,
      "A managerClosed the table: nothing unpaid",
      "SamReleased selections: Ada: 1× Latte",
    ])
    expect(items[0]).toHaveClass("text-danger-emphasis")
    expect(items[1]).not.toHaveClass("text-danger-emphasis")
  })

  it("shows no log for a cart without one", async () => {
    const { sheet } = await openSheet()

    expect(within(sheet).queryByRole("heading", { name: "Log" })).not.toBeInTheDocument()
  })

  it("flags the closed carts when one of them needs staff, and shows its log", async () => {
    carts = {
      open: [],
      recentlyClosed: [
        cartWith({ _id: "c0", status: "closed", updatedAt: at(5), managerLog: [line({ action: "stripeRefundFailed", details: payBack, byUserId: undefined })] }),
      ],
    }
    const { user, sheet } = await openSheet()

    const summary = within(sheet).getByText(/^Closed in the last 24 hours/)
    expect(summary).toHaveTextContent("Closed in the last 24 hours (1)Needs staff")
    await user.click(summary)

    expect(within(sheet).getByText(`Action needed: ${payBack}`)).toBeVisible()
  })

  it("doesn't flag closed carts with nothing for staff to do", async () => {
    carts = { open: [], recentlyClosed: [cartWith({ _id: "c0", status: "closed", updatedAt: at(5), managerLog: [line({})] })] }
    const { sheet } = await openSheet()

    expect(within(sheet).getByText(/^Closed in the last 24 hours/)).toHaveTextContent(/^Closed in the last 24 hours \(1\)$/)
  })
})
