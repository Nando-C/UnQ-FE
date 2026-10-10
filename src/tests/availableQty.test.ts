import { describe, it, expect } from "vitest"
import { availableQty } from "../lib/cart"
import type { IItem, ISplitItem } from "../typings/cart"
import type { IMenu } from "../typings/menu"

const menu = (id: string): IMenu => ({
  _id: id,
  name: `item-${id}`,
  image: "",
  short_description: "",
  description: "",
  price: 4.5,
  available: true,
  category: "food",
})

const item: IItem = { _id: "i1", menuId: menu("m1"), qty: 3, qtyPayed: 0 }

describe("availableQty", () => {
  it("subtracts other users' open split qty, but not the caller's own", () => {
    const split: ISplitItem[] = [
      { _id: "s1", userId: "u2", menuId: menu("m1"), qty: 1, splitStatus: "open" },
      { _id: "s2", userId: "u1", menuId: menu("m1"), qty: 2, splitStatus: "open" },
    ]
    expect(availableQty(item, split, "u1")).toBe(2)
  })

  it("ignores closed splits and splits for a different menu item", () => {
    const split: ISplitItem[] = [
      { _id: "s1", userId: "u2", menuId: menu("m1"), qty: 5, splitStatus: "closed" },
      { _id: "s2", userId: "u2", menuId: menu("m2"), qty: 5, splitStatus: "open" },
    ]
    expect(availableQty(item, split, "u1")).toBe(3)
  })

  it("subtracts qtyPayed as well as other users' holds", () => {
    const paid: IItem = { ...item, qtyPayed: 1 }
    const split: ISplitItem[] = [
      { _id: "s1", userId: "u2", menuId: menu("m1"), qty: 1, splitStatus: "open" },
    ]
    expect(availableQty(paid, split, "u1")).toBe(1)
  })

  it("can go to zero when another user holds every remaining unit", () => {
    const split: ISplitItem[] = [
      { _id: "s1", userId: "u2", menuId: menu("m1"), qty: 3, splitStatus: "open" },
    ]
    expect(availableQty(item, split, "u1")).toBe(0)
  })
})
