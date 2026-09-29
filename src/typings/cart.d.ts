import { IMenu } from "./menu";

export interface IItem {
    _id?: string
    menuId: IMenu | null | undefined
    qty: number
    // How many of `qty` are paid for. (The spelling is the API's.)
    qtyPayed?: number
}

export interface ISplitItem {
    _id: string
    userId: string
    menuId: IMenu | null | undefined
    qty: number
    // "open": selected to pay for; "closed": paid.
    splitStatus: string
    // Once paid: the price each unit was charged at, and when (payments from
    // before the BE recorded prices have neither).
    unitPrice?: number
    paidAt?: string
    // When the diner first selected it.
    claimedAt?: string
}

export interface ICart {
    _id: string
    userId: string
    shopId?: string
    tableId: string
    status: string
    items: IItem[]
    split: ISplitItem[]
    // Notes from the staff about changes to this cart, newest first (the BE
    // sends the recent ones meant for this diner or the whole table).
    notices?: ICartNotice[]
}

export interface ICartNotice {
    _id: string
    at: string
    message: string
}

export interface ICartStore {
    data: ICart
    // The table the diner is at (from the last table page they opened), so the
    // bottom bar can link to its cart and sign-in can return them to it.
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