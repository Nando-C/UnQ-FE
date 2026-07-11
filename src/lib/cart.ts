import { IItem, ISplitItem } from "../typings/cart";

// Cart/split entries carry menuId either populated (object) or as a bare id
// string depending on which BE response last landed in the store.
export const menuIdOf = (x: IItem | ISplitItem | undefined) =>
  typeof x?.menuId === "string" ? x.menuId : x?.menuId?._id;

// The pool the caller's own split can still draw from: total qty minus what's
// already paid minus whatever units OTHER diners currently hold in an open
// split for the same item. The caller's own open split is intentionally not
// subtracted here — that's the amount they're choosing how much of to hold.
export const availableQty = (
  item: IItem | undefined,
  split: ISplitItem[],
  myUserId: string
) => {
  const heldByOthers = split
    .filter(
      (s) =>
        s.splitStatus === "open" &&
        s.userId !== myUserId &&
        menuIdOf(s) === menuIdOf(item)
    )
    .reduce((sum, s) => sum + s.qty, 0);
  return (item?.qty ?? 0) - (item?.qtyPayed ?? 0) - heldByOthers;
};
