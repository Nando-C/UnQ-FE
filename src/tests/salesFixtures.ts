import type { IShop } from "../typings/shop"
import type { ISalesBucket, ISalesRange, ISalesTotals } from "../typings/sales"

// Builders for the sales tests: a shop, and the report's parts with every
// field zero unless given.

export const shop = { _id: "s1", name: "Cafe", cover: "", bio: "", open_times: "", web_URL: "", shopMg: [], menu: [], tables: [], timeZone: "Europe/London" } as unknown as IShop

export const bucket = (day: string, over: Partial<ISalesBucket> = {}): ISalesBucket => ({
  bucket: day, gross: 0, refunds: 0, net: 0, orders: 0, visits: 0, diners: 0, newDiners: 0, units: 0,
  byCategory: { food: 0, drinks: 0, other: 0 }, byProvider: { paypal: 0, stripe: 0 }, ...over,
})
export const totals = (over: Partial<ISalesTotals> = {}): ISalesTotals => ({
  gross: 0, refunds: 0, net: 0, orders: 0, pendingOrders: 0, visits: 0, diners: 0, returningDiners: 0, units: 0,
  byProvider: { paypal: { gross: 0, orders: 0 }, stripe: { gross: 0, orders: 0 } }, ...over,
})
export const range = (from: string, to: string, days: number): ISalesRange => ({ from, to, timeZone: "Europe/London", by: "day", days })
