import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse, delay } from "msw"
import TableList from "../components/Tables/TableList/TableList"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"
import type { IMenu } from "../typings/menu"
import type { IPayment, IRefund, ITableCarts } from "../typings/tables"

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

// Ada paid £8 for 2 Lattes and a Muffin (capture CAP-1).
const payment = (over: Partial<IPayment> = {}): IPayment => ({
  _id: "p1", provider: "paypal", providerCheckoutId: "O1", providerPaymentId: "CAP-1", currency: "GBP",
  userId: { _id: "u1", name: "Ada" }, paidAt: new Date().toISOString(), amount: 8,
  lines: [
    { menuId: "m1", name: "Latte", qty: 2, unitPrice: 3, refundedQty: 0 },
    { menuId: "m2", name: "Muffin", qty: 1, unitPrice: 2, refundedQty: 0 },
  ],
  ...over,
})

const cartsWith = (p: IPayment, refunds: IRefund[] = []): ITableCarts => ({
  open: [
    {
      _id: "c1", tableId: "t4", status: "open",
      items: [
        { _id: "i1", menuId: latte, qty: 3, qtyPayed: 2 },
        { _id: "i2", menuId: muffin, qty: 1, qtyPayed: 1 },
      ],
      split: [],
      payments: [p],
      refunds,
    },
  ],
  recentlyClosed: [],
})

let carts: ITableCarts
const refundBodies: unknown[] = []
let answer: () => Promise<Response> | Response

beforeEach(() => {
  carts = cartsWith(payment())
  refundBodies.length = 0
  answer = () => HttpResponse.json({ refund: { status: "completed" }, cart: carts.open[0] })
  server.use(
    http.get(`${BASE}/shops/s1/tables/status`, () =>
      HttpResponse.json([{ tableId: "t4", name: "4", state: "partlyPaid", owed: 3, paid: 8, attention: [] }])
    ),
    http.get(`${BASE}/shops/s1/tables/t4/carts`, () => HttpResponse.json(carts)),
    http.post(`${BASE}/shops/s1/carts/c1/refunds`, async ({ request }) => {
      refundBodies.push(await request.json())
      return answer()
    })
  )
})

const openSheet = async () => {
  const utils = renderWithProviders(<TableList shopId="s1" />, {
    preloadedState: { shops: { data: [shop], selected: shop, selectedMenu: null } },
  })
  await utils.user.click(screen.getByRole("button", { name: "View table 4" }))
  const sheet = await screen.findByRole("dialog")
  await within(sheet).findAllByText("Items")
  return { ...utils, sheet }
}

const refundButton = (sheet: HTMLElement) =>
  within(sheet).queryByRole("button", { name: "Refund items from Ada's payment of £8.00" })

describe("refunding a payment", () => {
  it("picks units up to what's paid, shows the total, confirms in two steps and refunds", async () => {
    const { user, sheet } = await openSheet()

    await user.click(refundButton(sheet)!)
    const picker = within(sheet).getByRole("group", { name: "Choose what to refund" })
    const more = within(picker).getByRole("button", { name: "Refund one more Latte" })
    const review = within(picker).getByRole("button", { name: "Review refund" })
    expect(review).toBeDisabled() // nothing picked yet

    await user.click(more)
    await user.click(more)
    expect(more).toBeDisabled() // only 2 were paid
    expect(within(picker).getByText("£6.00").closest("span")).toHaveTextContent("Refund £6.00")

    await user.click(review)
    expect(within(sheet).getByText(/^Refund £6.00 to Ada for 2× Latte\?/)).toHaveTextContent(
      "Refund £6.00 to Ada for 2× Latte? PayPal returns it to their account, the items are removed from the table's cart, and Ada will see a note. This can't be undone."
    )
    expect(refundBodies).toEqual([]) // nothing sent before the final button

    const confirm = within(sheet).getByRole("button", { name: "Refund £6.00 to Ada" })
    expect(confirm).toHaveClass("btn-danger")
    await user.click(confirm)

    expect(await within(sheet).findByText("Refunded £6.00 to Ada.")).toBeInTheDocument()
    expect(refundBodies).toEqual([{ paymentId: "p1", lines: [{ menuId: "m1", qty: 2 }] }])
  })

  it("can't be sent twice while the first is on its way", async () => {
    answer = async () => {
      await delay(100)
      return HttpResponse.json({ refund: { status: "completed" }, cart: carts.open[0] })
    }
    const { user, sheet } = await openSheet()

    await user.click(refundButton(sheet)!)
    await user.click(within(sheet).getByRole("button", { name: "Refund one more Muffin" }))
    await user.click(within(sheet).getByRole("button", { name: "Review refund" }))
    const confirm = within(sheet).getByRole("button", { name: "Refund £2.00 to Ada" })
    await user.click(confirm)
    expect(within(sheet).getByRole("button", { name: "Working…" })).toBeDisabled()
    await user.click(within(sheet).getByRole("button", { name: "Working…" }))

    await within(sheet).findByText("Refunded £2.00 to Ada.")
    expect(refundBodies).toHaveLength(1)
  })

  it("says nothing was refunded, and why, when PayPal refuses", async () => {
    answer = () =>
      HttpResponse.json(
        { message: "PayPal refund failed (422): Refund amount exceeded. Nothing was refunded." },
        { status: 502 }
      )
    const { user, sheet } = await openSheet()

    await user.click(refundButton(sheet)!)
    await user.click(within(sheet).getByRole("button", { name: "Refund one more Muffin" }))
    await user.click(within(sheet).getByRole("button", { name: "Review refund" }))
    await user.click(within(sheet).getByRole("button", { name: "Refund £2.00 to Ada" }))

    const alert = await within(sheet).findByText(/^PayPal refund failed/)
    expect(alert).toHaveTextContent("PayPal refund failed (422): Refund amount exceeded. Nothing was refunded.")
    expect(alert.closest(".alert")).toHaveClass("alert-danger")
  })

  it("shows what's been refunded and only offers what's left", async () => {
    carts = cartsWith(
      payment({ lines: [
        { menuId: "m1", name: "Latte", qty: 2, unitPrice: 3, refundedQty: 1 },
        { menuId: "m2", name: "Muffin", qty: 1, unitPrice: 2, refundedQty: 1 },
      ] }),
      [{ _id: "r1", paymentId: "p1", lines: [], amount: 5, currency: "GBP", status: "completed", at: new Date().toISOString() }]
    )
    const { user, sheet } = await openSheet()

    expect(within(sheet).getByText(/^Refunded/)).toHaveTextContent("Refunded £5.00")
    await user.click(refundButton(sheet)!)
    const picker = within(sheet).getByRole("group", { name: "Choose what to refund" })
    expect(within(picker).queryByText(/Muffin/)).not.toBeInTheDocument()
    expect(within(picker).getByText(/1 left/)).toBeInTheDocument()
  })

  it("warns about a refund in progress and offers no second one", async () => {
    carts = cartsWith(payment(), [
      { _id: "r1", paymentId: "p1", lines: [{ menuId: "m1", name: "Latte", qty: 1 }], amount: 3, currency: "GBP", status: "pending", at: new Date().toISOString() },
    ])
    const { sheet } = await openSheet()

    expect(within(sheet).getByText(/^Refund of £3.00 in progress/)).toHaveTextContent(
      "Refund of £3.00 in progress: PayPal hasn't confirmed it."
    )
    expect(refundButton(sheet)).not.toBeInTheDocument()
  })

  it("retries a refund in progress after saying it can't refund twice", async () => {
    carts = cartsWith(payment(), [
      { _id: "r1", paymentId: "p1", lines: [{ menuId: "m1", name: "Latte", qty: 1 }], amount: 3, currency: "GBP", status: "pending", at: new Date().toISOString() },
    ])
    let retries = 0
    server.use(
      http.post(`${BASE}/shops/s1/carts/c1/refunds/r1/retry`, () => {
        retries++
        return HttpResponse.json({ refund: { status: "completed" }, cart: carts.open[0] })
      })
    )
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Retry the £3.00 refund to Ada" }))
    expect(within(sheet).getByText(/^Retry the £3.00 refund/)).toHaveTextContent(
      "Retry the £3.00 refund to Ada for 1× Latte? PayPal is asked first whether it already went through; it's only sent again if it didn't, so it can't be refunded twice."
    )
    expect(retries).toBe(0)

    await user.click(within(sheet).getByRole("button", { name: "Retry refund" }))
    expect(await within(sheet).findByText("Refunded £3.00 to Ada.")).toBeInTheDocument()
    expect(retries).toBe(1)
  })

  it("shows why a retry couldn't settle it", async () => {
    carts = cartsWith(payment(), [
      { _id: "r1", paymentId: "p1", lines: [{ menuId: "m1", name: "Latte", qty: 1 }], amount: 3, currency: "GBP", status: "pending", at: new Date().toISOString() },
    ])
    const msg = "Couldn't check with PayPal (PayPal order lookup failed (503)). The refund is still in progress: try again shortly."
    server.use(
      http.post(`${BASE}/shops/s1/carts/c1/refunds/r1/retry`, () => HttpResponse.json({ message: msg }, { status: 502 }))
    )
    const { user, sheet } = await openSheet()

    await user.click(within(sheet).getByRole("button", { name: "Retry the £3.00 refund to Ada" }))
    await user.click(within(sheet).getByRole("button", { name: "Retry refund" }))
    expect(await within(sheet).findByText(msg)).toBeInTheDocument()
  })

  it("points to PayPal for a payment it can't refund itself", async () => {
    carts = cartsWith(payment({ providerPaymentId: undefined }))
    const { sheet } = await openSheet()

    await waitFor(() => expect(within(sheet).getByText("Refund this payment from PayPal.")).toBeInTheDocument())
    expect(refundButton(sheet)).not.toBeInTheDocument()
  })
})
