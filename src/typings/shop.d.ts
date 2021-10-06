import { IMenu } from "./menu";

export interface IShop {
    _id: string
    name: string
    cover: string
    bio: string
    open_times: string
    phone: number
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
    data: IShop[]
}