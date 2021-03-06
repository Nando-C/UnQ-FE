import { IMenu } from "./menu";

export interface IItem {
    _id?: string
    menuId: IMenu | null | undedfined
    qty: number
    qtyPayed?: number
    // totalPriceItems: number
}

export interface ISplitItem {
    _id: string
    userId: string
    menuId: string | null | undedfined
    qty: number
    splitStatus: string
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
}