import { IItem, ISplitItem } from "./cart";

// The shop manager's view of the tables (UnQ-BE GET /shops/:shopId/tables/status
// and GET /shops/:shopId/tables/:tableId/carts).

export type TableState = "free" | "ordering" | "waitingToPay" | "partlyPaid"
export type TableAttention = "soldOut" | "duplicateCarts" | "staleSelection"

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

export interface IPayment {
    _id: string
    provider: string
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
}

export interface IManagerCart {
    _id: string
    tableId: string
    status: string
    items: IItem[]
    split: IManagerSplit[]
    payments?: IPayment[]
    refunds?: IRefund[]
    createdAt?: string
    updatedAt?: string
}

export interface ITableCarts {
    open: IManagerCart[]
    recentlyClosed: IManagerCart[]
}
