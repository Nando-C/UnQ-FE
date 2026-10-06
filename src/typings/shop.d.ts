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
    // Tables the manager deleted (only in GET /shops/me; absent on shops from
    // before they were kept). Their carts stay reachable for refunds.
    deletedTables?: IDeletedTable[]
    menu: IMenu[]
}

// A shop as the home page lists it (GET /shops/browse): no menu or tables.
export interface IShopSummary {
    _id: string
    name: string
    cover: string
    bio?: string
}

// A page of GET /shops/browse; `next` is the cursor for the page after it,
// null on the last.
export interface IShopPage {
    shops: IShopSummary[]
    next: string | null
}

export interface IDeletedTable {
    _id: string
    name: string
    deletedAt: string
    // Something is left to do there: an open cart, or a payment or refund
    // PayPal hasn't confirmed.
    needsAttention?: boolean
    // Until when its sheet shows a closed cart (a day after the latest one
    // last changed); absent when it shows none.
    recentCartsUntil?: string
}

export interface ITable {
    _id: string
    name: string
    Qr_Url: string
}

export interface IShopStore {
    // The home page's shops (GET /shops/browse): the pages loaded so far of
    // the search `allQuery` ("" for every shop).
    all: IShopSummary[]
    // The signed-in manager's own shops (GET /shops/me).
    data: IShop[]
    // The shop whose page is open (a table's menu, or the manager's shop page).
    selected: IShop | null
    selectedMenu: IMenu | null
    // Where the fetches of `all` (its first page) and `data` stand, so an
    // empty list can be told apart from one still loading or one that failed.
    // Absent = not asked.
    allStatus?: LoadStatus
    dataStatus?: LoadStatus
    // The home page's list (see the reducers): the search `all` answers, the
    // cursor of its next page (null on the last), how loading that page stands
    // and the number of the request last sent for one; the search last asked
    // for, that request's number and when it was sent, and when the shops held
    // were asked for.
    allQuery?: string
    allNext?: string | null
    allMoreStatus?: LoadStatus
    allMoreLatest?: number
    allWanted?: string
    allLatest?: number
    allLatestAt?: number
    allLoadedAt?: number
    // The id of a shop whose fetch for `selected` failed, until it is asked again.
    selectedFailed?: string
    // The shop last asked for as `selected` and that request's number, and the
    // number of the request the held `selected` came from (see the reducers).
    selectedWanted?: string
    selectedLatest?: number
    selectedFrom?: number
}

export type LoadStatus = "loading" | "ready" | "failed"