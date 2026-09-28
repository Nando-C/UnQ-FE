import { IMenu } from "./menu";

export interface IItem {
    _id?: string
    menuId: IMenu | null | undefined
    qty: number
    qtyPayed?: number
    // totalPriceItems: number
}

export interface ISplitItem {
    _id: string
    userId: string
    menuId: IMenu | null | undefined
    qty: number
    splitStatus: string
    // Once paid: the price each unit was charged at, and when (payments from
    // before the BE recorded prices have neither).
    unitPrice?: number
    paidAt?: string
    // When the diner first selected it.
    claimedAt?: string
    // total_price_items: number
}

export interface ICart {
    _id: string
    userId: string
    shopId?: string
    tableId: string
    status: string
    items: IItem[]
    split: ISplitItem[]
}

export interface ICartStore {
    data: ICart
    pointers: {
        shopId: string
        tableId: string
    }
    // What I've asked my open split to hold, per menu item id, while the BE
    // catches up (see setSplitQty). Absent once it agrees.
    pending?: Record<string, number>
    // Why the last change to an item's split was undone, per menu item id.
    splitErrors?: Record<string, string>
    // The latest getTableCart request; answers to older ones are ignored.
    cartRequestId?: string
}