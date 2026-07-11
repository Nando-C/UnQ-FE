import { IItem, ISplitItem } from "../typings/cart";

// Cart/split entries carry menuId either populated (object) or as a bare id
// string depending on which BE response last landed in the store.
export const menuIdOf = (x: IItem | ISplitItem | undefined) =>
  typeof x?.menuId === "string" ? x.menuId : x?.menuId?._id;
