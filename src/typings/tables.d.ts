import { IItem, ISplitItem } from "./cart";

// The shop manager's view of the tables (UnQ-BE GET /shops/:shopId/tables/status
// and GET /shops/:shopId/tables/:tableId/carts).

export type TableState = "free" | "ordering" | "waitingToPay" | "partlyPaid"
export type TableAttention = "soldOut" | "duplicateCarts" | "staleSelection" | "paymentPending" | "payBack"

export interface ITableStatus {
    tableId: string
    name: string
    state: TableState
    owed: number
    paid: number
    heldSince?: string
    attention: TableAttention[]
}

// A diner as the manager endpoints show them: first name only.
export interface IDiner {
    _id: string
    name: string
}

export interface IManagerSplit extends Omit<ISplitItem, "userId"> {
    userId: IDiner | null
}

export interface IPaymentLine {
    menuId: string
    name: string
    qty: number
    unitPrice: number
    refundedQty: number
}

// UnQ-BE's PAYMENT_PROVIDERS; their names and refund destinations are in
// lib/providers.ts, how each one's checkout ends in lib/paymentOutcome.ts.
export type PaymentProvider = "paypal" | "stripe"

export interface IPayment {
    _id: string
    provider: PaymentProvider | (string & {})
    // pending: its provider took it but hasn't confirmed it (check it); failed: it
    // didn't go through, nothing was taken. Absent on older answers: completed.
    status?: "completed" | "pending" | "failed"
    providerCheckoutId: string
    providerPaymentId?: string
    currency: string
    userId: IDiner | null
    paidAt: string
    amount: number
    lines: IPaymentLine[]
}

// A manager's refund of units of a payment: pending while the provider is
// asked, then completed or failed. One still pending after the request means
// the provider's answer wasn't recorded: check the provider.
export interface IRefund {
    _id: string
    paymentId: string
    lines: { menuId: string; name: string; qty: number }[]
    amount: number
    currency: string
    status: "pending" | "completed" | "failed"
    providerRefundId?: string
    failureReason?: string
    at: string
    // Why the manager refunded (none on older refunds); `reasonNote` only
    // with "other".
    reason?: RefundReason
    reasonNote?: string
}

// UnQ-BE's REFUND_REASONS; their labels are in lib/refundReasons.ts.
export type RefundReason = "unavailable" | "wrong_item" | "quality" | "long_wait" | "paid_by_mistake" | "changed_mind" | "other"

// What a line in a cart's log says was done (UnQ-BE's managerLog actions);
// their labels are in lib/tables.ts. The BE sends a string: one it adds later
// shows as it is.
export type ManagerLogAction =
    | "releaseSelection" | "removeItem" | "close" | "mergeInto" | "refund" | "checkPayment" | "paybackDone"
    | "stripeRefundFailed" | "stripeRefundedRecorded" | "stripeFinished"

// A line in a cart's log: what a manager did (`byUserId`; null when their
// account is gone), or what the server did (none), e.g. a card refund Stripe
// won't make, for staff to pay back another way.
export interface IManagerLogEntry {
    at: string
    byUserId?: IDiner | null
    action: ManagerLogAction | (string & {})
    details: string
}

export interface IManagerCart {
    _id: string
    tableId: string
    status: string
    items: IItem[]
    split: IManagerSplit[]
    payments?: IPayment[]
    refunds?: IRefund[]
    // Oldest first, as the BE keeps it.
    managerLog?: IManagerLogEntry[]
    createdAt?: string
    updatedAt?: string
}

export interface ITableCarts {
    open: IManagerCart[]
    recentlyClosed: IManagerCart[]
    // The table's pay-backs, owed or marked done in the last 30 days, newest
    // first, whichever cart they came from (it may be gone).
    paybacks?: IPayback[]
}

// Money staff must give a diner back another way, because Stripe won't
// (UnQ-BE's Payback): a payment handed to staff (`refundRefused`), or a
// manager's card refund Stripe accepted, then failed (`refundFailed`).
export type PaybackKind = "refundRefused" | "refundFailed"
// What a manager marked it as: paid back, a dispute handled (the diner's bank
// returns the money), or checked (a cart shows its payment as paid).
export type PaybackDoneAs = "paidBack" | "handled" | "checked"

export interface IPayback {
    _id: string
    shopId: string
    tableId: string
    cartId: string
    kind: PaybackKind | (string & {})
    // null: the diner's account is gone.
    userId: IDiner | null
    // Owed, in pounds.
    amount: number
    currency: string
    paymentIntentId?: string
    refundId?: string
    // A refundFailed one: the whole payment (a dispute is of all of it).
    paymentAmount?: number
    // The diner disputes the payment: their bank returns the money, not staff.
    disputed?: boolean
    // Until marked done.
    owed?: boolean
    // An owed refundRefused one whose payment a cart shows as paid (worked
    // out by the BE when read): check it before paying it back.
    recorded?: boolean
    at: string
    doneAt?: string
    // null: the manager's account is gone.
    doneByUserId?: IDiner | null
    doneAs?: PaybackDoneAs
}
