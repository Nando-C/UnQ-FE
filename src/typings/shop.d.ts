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
    // Something is left to do there: an open cart, a payment or refund its
    // provider hasn't confirmed, or a diner still to be paid back.
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
    // The signed-in manager's own shops (GET /shops/me).
    data: IShop[]
    // The shop whose page is open (a table's menu, or the manager's shop page).
    selected: IShop | null
    selectedMenu: IMenu | null
    // Where the fetch of `data` stands, so an empty list can be told apart
    // from one still loading or one that failed. Absent = not asked.
    dataStatus?: LoadStatus
    // The id of a shop whose fetch for `selected` failed, until it is asked again.
    selectedFailed?: string
    // The shop last asked for as `selected` and that request's number, and the
    // number of the request the held `selected` came from (see the reducers).
    selectedWanted?: string
    selectedLatest?: number
    selectedFrom?: number
}

// The home page's shops (GET /shops/browse; see browseSlice's reducers).
export interface IBrowseStore {
    // The pages loaded so far of the search `query` ("" for every shop), and
    // the cursor of the page after them (null on the last).
    shops: IShopSummary[]
    query: string
    next: string | null
    // The search last asked for, that request's id and when it was sent,
    // and where it stands. Absent status = not asked.
    wanted: string
    latest?: string
    askedAt?: number
    status?: LoadStatus
    // Where loading a next page stands, and the id of the latest request for one.
    moreStatus?: LoadStatus
    moreLatest?: string
}

export type LoadStatus = "loading" | "ready" | "failed"