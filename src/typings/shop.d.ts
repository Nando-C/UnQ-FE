export interface IShop {
    _id: string
    name: string
    cover: string
    bio: string
    open_times: string
    phone: string
    web_URL: string
    shopMg: string[]
    tables: ITable[]
    menu: string[]
}

export interface ITable {
    _id: string
    name: string
    Qr_Url: string
}

export interface IShopStore {
    data: IShop[]
}