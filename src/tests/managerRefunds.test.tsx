import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse, delay } from "msw"
import TableList from "../components/Tables/TableList/TableList"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"
import type { IMenu } from "../typings/menu"
import type { IPayment, IRefund, ITableCarts, RefundReason } from "../typings/tables"
import { REFUND_REASON_LABEL, REFUND_REASONS, refundReasonText } from "../lib/refundReasons"
import { apiErrorBody } from "../lib/errors"
import { AxiosError } from "axios"

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

// A refund of the payment: one Latte, in progress, unless `over` says otherwise.
const refundOf = (over: Partial<IRefund> = {}): IRefund => ({
  _id: "r1", paymentId: "p1", lines: [{ menuId: "m1", name: "Latte", qty: 1 }], amount: 3, currency: "GBP",
  status: "pending", at: new Date().toISOString(), ...over,
})

// The BE refusing Other's note.
const noteRefused = () =>
  HttpResponse.json(
    { message: "Validation failed", details: [{ path: "reasonNote", message: "Say what happened" }] },
    { status: 400 }
  )

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

type User = Awaited<ReturnType<typeof openSheet>>["user"]
// Answers the £3.00 refund question and waits for it to be done.
const confirmRefund = async (user: User, sheet: HTMLElement) => {
  await user.click(within(sheet).getByRole("button", { name: "Refund £3.00 to Ada" }))
  await within(sheet).findByText("Refunded £3.00 to Ada.")
}
const chooseReason = (user: User, sheet: HTMLElement, label = "Wrong item served") =>
  user.selectOptions(within(sheet).getByRole("combobox", { name: "Reason" }), label)

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
    expect(review).toBeDisabled() // no reason yet

    await chooseReason(user, sheet)
    await user.click(review)
    expect(within(sheet).getByText(/^Refund £6.00 to Ada for 2× Latte\?/)).toHaveTextContent(
      "Refund £6.00 to Ada for 2× Latte? Reason: Wrong item served. PayPal returns it to their account, the items are removed from the table's cart, and Ada will see a note. This can't be undone."
    )
    expect(refundBodies).toEqual([]) // nothing sent before the final button

    const confirm = within(sheet).getByRole("button", { name: "Refund £6.00 to Ada" })
    expect(confirm).toHaveClass("btn-danger")
    await user.click(confirm)

    expect(await within(sheet).findByText("Refunded £6.00 to Ada.")).toBeInTheDocument()
    expect(refundBodies).toEqual([{ paymentId: "p1", lines: [{ menuId: "m1", qty: 2 }], reason: "wrong_item" }])
  })

  it("can't be sent twice while the first is on its way", async () => {
    answer = async () => {
      await delay(100)
      return HttpResponse.json({ refund: { status: "completed" }, cart: carts.open[0] })
    }
    const { user, sheet } = await openSheet()

    await user.click(refundButton(sheet)!)
    await user.click(within(sheet).getByRole("button", { name: "Refund one more Muffin" }))
    await chooseReason(user, sheet)
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
    await chooseReason(user, sheet)
    await user.click(within(sheet).getByRole("button", { name: "Review refund" }))
    await user.click(within(sheet).getByRole("button", { name: "Refund £2.00 to Ada" }))

    const alert = await within(sheet).findByText(/^PayPal refund failed/)
    expect(alert).toHaveTextContent("PayPal refund failed (422): Refund amount exceeded. Nothing was refunded.")
    expect(alert.closest(".alert")).toHaveClass("alert-danger")
  })

  it("keeps the picks, and focus, when the refund question is cancelled", async () => {
    const { user, sheet } = await openSheet()

    await user.click(refundButton(sheet)!)
    await user.click(within(sheet).getByRole("button", { name: "Refund one more Latte" }))
    await chooseReason(user, sheet)
    await user.click(within(sheet).getByRole("button", { name: "Review refund" }))
    // Nothing in the picker can change the question being asked.
    expect(within(sheet).getByRole("button", { name: "Refund one more Latte" })).toBeDisabled()
    expect(within(sheet).getByRole("combobox", { name: "Reason" })).toBeDisabled()
    const question = sheet.querySelector(".modal-footer") as HTMLElement
    await user.click(within(question).getByRole("button", { name: "Cancel" }))

    const review = within(sheet).getByRole("button", { name: "Review refund" })
    expect(review).toHaveFocus()
    expect(review).toBeEnabled()
    const picker = within(sheet).getByRole("group", { name: "Choose what to refund" })
    expect(within(picker).getByText("£3.00").closest("span")).toHaveTextContent("Refund £3.00")
    expect(within(picker).getByRole("combobox", { name: "Reason" })).toHaveValue("wrong_item")
    expect(refundBodies).toEqual([])
  })

  it("closes the picker once the refund is sent", async () => {
    const { user, sheet } = await openSheet()

    await user.click(refundButton(sheet)!)
    await user.click(within(sheet).getByRole("button", { name: "Refund one more Latte" }))
    await chooseReason(user, sheet)
    await user.click(within(sheet).getByRole("button", { name: "Review refund" }))
    await confirmRefund(user, sheet)
    expect(within(sheet).queryByRole("group", { name: "Choose what to refund" })).not.toBeInTheDocument()
  })

  it("shows what's been refunded and only offers what's left", async () => {
    carts = cartsWith(
      payment({ lines: [
        { menuId: "m1", name: "Latte", qty: 2, unitPrice: 3, refundedQty: 1 },
        { menuId: "m2", name: "Muffin", qty: 1, unitPrice: 2, refundedQty: 1 },
      ] }),
      [refundOf({ lines: [], amount: 5, status: "completed" })]
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
      refundOf(),
    ])
    const { sheet } = await openSheet()

    expect(within(sheet).getByText(/^Refund of £3.00 in progress/)).toHaveTextContent(
      "Refund of £3.00 in progress: PayPal hasn't confirmed it."
    )
    expect(refundButton(sheet)).not.toBeInTheDocument()
  })

  it("retries a refund in progress after saying it can't refund twice", async () => {
    carts = cartsWith(payment(), [
      refundOf(),
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
      refundOf(),
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

describe("a refund's reason", () => {
  // Picks a Latte and opens the picker.
  const pickLatte = async () => {
    const utils = await openSheet()
    await utils.user.click(refundButton(utils.sheet)!)
    await utils.user.click(within(utils.sheet).getByRole("button", { name: "Refund one more Latte" }))
    const picker = within(utils.sheet).getByRole("group", { name: "Choose what to refund" })
    return { ...utils, picker, review: within(picker).getByRole("button", { name: "Review refund" }) }
  }

  it("offers the reasons in order, none chosen to start with", async () => {
    const { picker } = await pickLatte()
    const select = within(picker).getByRole("combobox", { name: "Reason" })
    expect(select).toHaveValue("")
    expect(select).toBeRequired()
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose a reason…",
      "Item unavailable or sold out",
      "Wrong item served",
      "Quality issue",
      "Long wait",
      "Paid by mistake or twice",
      "Customer changed their mind",
      "Other",
    ])
  })

  it.each(REFUND_REASONS.filter((r) => r !== "other"))("sends %s, and says it in the question", async (reason: RefundReason) => {
    const { user, sheet, review } = await pickLatte()
    await chooseReason(user, sheet, REFUND_REASON_LABEL[reason])
    expect(within(sheet).queryByRole("textbox", { name: "What happened?" })).not.toBeInTheDocument()

    await user.click(review)
    expect(within(sheet).getByText(/^Refund £3.00 to Ada for/)).toHaveTextContent(`Reason: ${REFUND_REASON_LABEL[reason]}.`)
    await confirmRefund(user, sheet)
    expect(refundBodies).toEqual([{ paymentId: "p1", lines: [{ menuId: "m1", qty: 1 }], reason }])
  })

  it("asks what happened for Other, and waits for an answer", async () => {
    const { user, sheet, picker, review } = await pickLatte()
    await chooseReason(user, sheet, "Other")
    const note = within(picker).getByRole("textbox", { name: "What happened?" })
    expect(note).toBeRequired()
    expect(note).toHaveAccessibleDescription("0 of 200 characters")
    expect(review).toBeDisabled()

    await user.type(note, "   ")
    expect(review).toBeDisabled() // spaces aren't an answer
    await user.clear(note)
    await user.type(note, " Cold coffee ")
    expect(note).toHaveAccessibleDescription("13 of 200 characters")
    expect(review).toBeEnabled()

    await user.click(review)
    expect(within(sheet).getByText(/^Refund £3.00 to Ada for/)).toHaveTextContent("Reason: Other (“Cold coffee”).")
    await confirmRefund(user, sheet)
    expect(refundBodies).toEqual([
      { paymentId: "p1", lines: [{ menuId: "m1", qty: 1 }], reason: "other", reasonNote: "Cold coffee" },
    ])
  })

  it("takes up to 200 characters for Other's note", async () => {
    const { user, sheet, picker } = await pickLatte()
    await chooseReason(user, sheet, "Other")
    const note = within(picker).getByRole("textbox", { name: "What happened?" })
    expect(note).toHaveAttribute("maxlength", "200")
    await user.click(note)
    await user.paste("x".repeat(200))
    expect(note).toHaveAccessibleDescription("200 of 200 characters")
  })

  it("sends no note once another reason replaces Other", async () => {
    const { user, sheet, picker, review } = await pickLatte()
    await chooseReason(user, sheet, "Other")
    await user.type(within(picker).getByRole("textbox", { name: "What happened?" }), "Cold")
    await chooseReason(user, sheet, "Quality issue")
    expect(within(picker).queryByRole("textbox", { name: "What happened?" })).not.toBeInTheDocument()

    await user.click(review)
    await confirmRefund(user, sheet)
    expect(refundBodies).toEqual([{ paymentId: "p1", lines: [{ menuId: "m1", qty: 1 }], reason: "quality" }])
  })

  it("needs something to refund as well as a reason", async () => {
    const { user, sheet } = await openSheet()
    await user.click(refundButton(sheet)!)
    await chooseReason(user, sheet)
    expect(within(sheet).getByRole("button", { name: "Review refund" })).toBeDisabled()
  })

  it("shows the BE's message under the field it refused, and keeps the picker", async () => {
    answer = () =>
      noteRefused()
    const { user, sheet, picker, review } = await pickLatte()
    await chooseReason(user, sheet, "Other")
    const note = within(picker).getByRole("textbox", { name: "What happened?" })
    await user.type(note, "Cold")
    await user.click(review)
    await user.click(within(sheet).getByRole("button", { name: "Refund £3.00 to Ada" }))

    await waitFor(() => expect(note).toBeInvalid())
    expect(note).toHaveAccessibleDescription("Say what happened 4 of 200 characters")
    // Also said in the sheet's status message, which screen readers announce.
    expect(within(sheet).getByRole("status")).toHaveTextContent("Say what happened")
    expect(within(picker).getByText("£3.00").closest("span")).toHaveTextContent("Refund £3.00")

    await user.type(note, "er") // changing it clears the message
    expect(note).toBeValid()
    expect(within(picker).queryByText("Say what happened")).not.toBeInTheDocument()
  })

  it("never sends more than is left once the table reloads under the open picker", async () => {
    answer = () => {
      // Meanwhile another manager refunded one Latte.
      carts = cartsWith(
        payment({ lines: [
          { menuId: "m1", name: "Latte", qty: 2, unitPrice: 3, refundedQty: 1 },
          { menuId: "m2", name: "Muffin", qty: 1, unitPrice: 2, refundedQty: 0 },
        ] }),
        [refundOf({ _id: "r9", status: "completed" })]
      )
      return noteRefused()
    }
    const { user, sheet, picker, review } = await pickLatte()
    await user.click(within(picker).getByRole("button", { name: "Refund one more Latte" }))
    await chooseReason(user, sheet, "Other")
    const note = within(picker).getByRole("textbox", { name: "What happened?" })
    await user.type(note, "Cold")
    await user.click(review)
    await user.click(within(sheet).getByRole("button", { name: "Refund £6.00 to Ada" }))
    await waitFor(() => expect(within(picker).getByText("£3.00 each · 1 left")).toBeInTheDocument())
    expect(within(picker).getByText("£3.00").closest("span")).toHaveTextContent("Refund £3.00")

    answer = () => HttpResponse.json({ refund: { status: "completed" }, cart: carts.open[0] })
    await user.type(note, "!")
    await user.click(review)
    await confirmRefund(user, sheet)
    expect(refundBodies[1]).toEqual({ paymentId: "p1", lines: [{ menuId: "m1", qty: 1 }], reason: "other", reasonNote: "Cold!" })
  })

  it.each([
    ["another refund is under way", { refundedQty: 0 }, "pending"],
    ["nothing is left", { refundedQty: 2 }, "completed"],
  ] as const)("closes the open picker once a reload shows %s", async (_, latte, status) => {
    answer = () => {
      carts = cartsWith(
        payment({ lines: [
          { menuId: "m1", name: "Latte", qty: 2, unitPrice: 3, ...latte },
          { menuId: "m2", name: "Muffin", qty: 1, unitPrice: 2, refundedQty: 1 },
        ] }),
        [refundOf({ _id: "r9", lines: [{ menuId: "m1", name: "Latte", qty: 2 }], amount: 6, status })]
      )
      return noteRefused()
    }
    const { user, sheet, review } = await pickLatte()
    await chooseReason(user, sheet, "Other")
    await user.type(within(sheet).getByRole("textbox", { name: "What happened?" }), "Cold")
    await user.click(review)
    await user.click(within(sheet).getByRole("button", { name: "Refund £3.00 to Ada" }))

    await waitFor(() =>
      expect(within(sheet).queryByRole("group", { name: "Choose what to refund" })).not.toBeInTheDocument()
    )
    expect(refundButton(sheet)).not.toBeInTheDocument()
    expect(refundBodies).toHaveLength(1)
  })

  it("keeps the question and its picks through a reload, and closes the picker once it's cancelled", async () => {
    const { user, sheet, review } = await pickLatte()
    await chooseReason(user, sheet)
    await user.click(review)
    // Another refund of both Lattes gets under way, and the sheet reloads.
    carts = cartsWith(payment(), [
      refundOf({ _id: "r9", lines: [{ menuId: "m1", name: "Latte", qty: 2 }], amount: 6 }),
    ])
    document.dispatchEvent(new Event("visibilitychange"))
    await within(sheet).findByText(/^Refund of £6.00 in progress/)

    // The picker still shows what the question is about.
    const picker = within(sheet).getByRole("group", { name: "Choose what to refund" })
    expect(within(picker).getByText("£3.00").closest("span")).toHaveTextContent("Refund £3.00")
    const question = sheet.querySelector(".modal-footer") as HTMLElement
    expect(within(question).getByRole("button", { name: "Refund £3.00 to Ada" })).toBeEnabled()
    await user.click(within(question).getByRole("button", { name: "Cancel" }))

    expect(within(sheet).queryByRole("group", { name: "Choose what to refund" })).not.toBeInTheDocument()
    expect(refundButton(sheet)).not.toBeInTheDocument()
    expect(refundBodies).toEqual([])
  })

  it("closes the picker on any other failure", async () => {
    answer = () => HttpResponse.json({ message: "Validation failed", details: [{ path: "lines", message: "List each item once" }] }, { status: 400 })
    const { user, sheet, review } = await pickLatte()
    await chooseReason(user, sheet)
    await user.click(review)
    await user.click(within(sheet).getByRole("button", { name: "Refund £3.00 to Ada" }))

    await within(sheet).findByText("List each item once") // the BE's details, not just "Validation failed"
    expect(within(sheet).queryByRole("group", { name: "Choose what to refund" })).not.toBeInTheDocument()
  })

  it("shows a refund in progress with its reason", async () => {
    carts = cartsWith(payment(), [
      refundOf({ reason: "long_wait" }),
    ])
    const { sheet } = await openSheet()
    expect(within(sheet).getByText(/^Refund of £3.00 in progress/)).toHaveTextContent(
      "Refund of £3.00 in progress: PayPal hasn't confirmed it. Reason: Long wait."
    )
  })

  it("shows each refund with its reason on the sheet, and none on older refunds", async () => {
    carts = cartsWith(
      payment({ lines: [
        { menuId: "m1", name: "Latte", qty: 2, unitPrice: 3, refundedQty: 2 },
        { menuId: "m2", name: "Muffin", qty: 1, unitPrice: 2, refundedQty: 1 },
      ] }),
      [
        refundOf({ status: "completed", reason: "wrong_item" }),
        refundOf({ _id: "r2", amount: 2, status: "completed", reason: "other", reasonNote: "Burnt" }),
        refundOf({ _id: "r3", status: "completed" }),
      ]
    )
    const { sheet } = await openSheet()

    expect(within(sheet).getAllByText(/^Refunded/).map((el) => el.textContent)).toEqual([
      "Refunded £3.00 · Wrong item served",
      "Refunded £2.00 · Other (“Burnt”)",
      "Refunded £3.00",
      "Refunded in all £8.00",
    ])
  })
})

describe("a payment PayPal hasn't confirmed", () => {
  const checkButton = (sheet: HTMLElement) =>
    within(sheet).queryByRole("button", { name: "Check Ada's payment of £8.00 with PayPal" })

  it("offers a check, and no refund, only while it's pending", async () => {
    carts = cartsWith(payment({ status: "pending" }))
    const { sheet } = await openSheet()

    expect(within(sheet).getByText(/^Awaiting PayPal/)).toHaveTextContent(
      "Awaiting PayPal: it took this payment but hasn't confirmed it. The items are held as paid until then."
    )
    expect(checkButton(sheet)).toBeInTheDocument()
    expect(refundButton(sheet)).not.toBeInTheDocument()
  })

  it("offers no check on a completed payment", async () => {
    carts = cartsWith(payment({ status: "completed" }))
    const { sheet } = await openSheet()

    expect(refundButton(sheet)).toBeInTheDocument()
    expect(checkButton(sheet)).not.toBeInTheDocument()
  })

  it("checks it with PayPal after saying what either answer does", async () => {
    carts = cartsWith(payment({ status: "pending" }))
    let checks = 0
    server.use(
      http.post(`${BASE}/shops/s1/carts/c1/payments/p1/check`, () => {
        checks++
        return HttpResponse.json({ payment: { status: "completed" }, cart: carts.open[0] })
      })
    )
    const { user, sheet } = await openSheet()

    await user.click(checkButton(sheet)!)
    expect(within(sheet).getByText(/^Check Ada's payment/)).toHaveTextContent(
      "Check Ada's payment of £8.00 with PayPal? If PayPal confirmed it, it's recorded as paid. If PayPal declined it, nothing was taken and its items become unpaid again. Ada will see a note either way."
    )
    expect(checks).toBe(0)

    await user.click(within(sheet).getByRole("button", { name: "Check payment" }))
    expect(await within(sheet).findByText("PayPal confirmed Ada's payment of £8.00.")).toBeInTheDocument()
    expect(checks).toBe(1)
  })

  it("says so when PayPal declined it", async () => {
    carts = cartsWith(payment({ status: "pending" }))
    server.use(
      http.post(`${BASE}/shops/s1/carts/c1/payments/p1/check`, () =>
        HttpResponse.json({ payment: { status: "failed" }, cart: carts.open[0] })
      )
    )
    const { user, sheet } = await openSheet()

    await user.click(checkButton(sheet)!)
    await user.click(within(sheet).getByRole("button", { name: "Check payment" }))
    expect(
      await within(sheet).findByText(
        "PayPal didn't complete Ada's payment of £8.00: nothing was taken, and those items are unpaid again."
      )
    ).toBeInTheDocument()
  })

  it("shows PayPal still processing it as a warning", async () => {
    carts = cartsWith(payment({ status: "pending" }))
    server.use(
      http.post(`${BASE}/shops/s1/carts/c1/payments/p1/check`, () =>
        HttpResponse.json({ message: "PayPal is still processing this payment. Check again later" }, { status: 409 })
      )
    )
    const { user, sheet } = await openSheet()

    await user.click(checkButton(sheet)!)
    await user.click(within(sheet).getByRole("button", { name: "Check payment" }))
    expect(
      await within(sheet).findByText("PayPal is still processing this payment. Check again later. Here's the table as it is now.")
    ).toBeInTheDocument()
  })

  it("shows a failed payment with no way to refund it", async () => {
    carts = cartsWith(payment({ status: "failed" }))
    const { sheet } = await openSheet()

    expect(within(sheet).getByText("Didn't go through at PayPal: nothing was taken.")).toBeInTheDocument()
    expect(refundButton(sheet)).not.toBeInTheDocument()
    expect(checkButton(sheet)).not.toBeInTheDocument()
  })
})

describe("refundReasonText", () => {
  it("names each reason, Other with its note, and spells out one it doesn't know", () => {
    expect(refundReasonText("quality")).toBe("Quality issue")
    expect(refundReasonText("other", "Burnt")).toBe("Other (“Burnt”)")
    expect(refundReasonText("other")).toBe("Other")
    expect(refundReasonText("late_delivery")).toBe("Late delivery")
    expect(refundReasonText("toString")).toBe("ToString") // only the list's own reasons
    expect(refundReasonText(undefined)).toBeUndefined()
  })
})

describe("apiErrorBody", () => {
  const failed = (data: unknown) => new AxiosError("x", "ERR", undefined, undefined, { data, status: 400 } as never)

  it("reads the BE's message and details", () => {
    const body = { message: "Validation failed", details: [{ path: "reason", message: "Bad" }] }
    expect(apiErrorBody(failed(body))).toEqual(body)
  })

  it("ignores an answer that isn't the BE's shape", () => {
    expect(apiErrorBody(failed("<html>Bad gateway</html>"))).toEqual({})
    expect(apiErrorBody(failed({ message: 3, details: "List each item once" }))).toEqual({})
    expect(apiErrorBody(new Error("offline"))).toEqual({})
  })
})
