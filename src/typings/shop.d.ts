import { IMenu } from "./menu";

export interface IShop {
    _id: string
    name: string
    cover: string
    bio: string
    open_times: string
    phone?: string
    web_URL: string
    shopMg: string[]
    tables: ITable[]
    menu: IMenu[]
}

export interface ITable {
    _id: string
    name: string
    Qr_Url: string
}

export interface IShopStore {
    // Every shop, for customers to browse (GET /shops/).
    all: IShop[]
    // The signed-in manager's own shops (GET /shops/me). Kept apart from `all`:
    // both are fetched on a manager's first page load, in either order.
    data: IShop[]
    // The shop whose page is open (a table's menu, or the manager's shop page).
    selected: IShop | null
    selectedMenu: IMenu | null
    // Where the fetches of `all` and `data` stand, so an empty list can be
    // told apart from one still loading or one that failed. Absent = not asked.
    allStatus?: LoadStatus
    dataStatus?: LoadStatus
    // The id of a shop whose fetch for `selected` failed, until it is asked again.
    selectedFailed?: string
}

export type LoadStatus = "loading" | "ready" | "failed"