import { describe, it, expect } from "vitest";
import shopReducer, { fetchAllShops, fetchShopList } from "../redux/slices/shopSlice";
import { IShop } from "../typings/shop";

const shop = (_id: string) => ({ _id, name: _id, menu: [], tables: [] }) as unknown as IShop;

describe("shops store", () => {
  it("keeps the manager's shops when every shop's list arrives after them", () => {
    let state = shopReducer(undefined, fetchShopList.fulfilled([shop("mine")], ""));
    state = shopReducer(state, fetchAllShops.fulfilled([shop("mine"), shop("theirs")], ""));

    expect(state.data.map((s) => s._id)).toEqual(["mine"]);
    expect(state.all.map((s) => s._id)).toEqual(["mine", "theirs"]);
  });
});
