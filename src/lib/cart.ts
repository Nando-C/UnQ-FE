import { IItem, ISplitItem } from "../typings/cart";

// The menu item id of a cart line or split. menuId is normally the populated
// menu item, but can be a bare id string; this reads the id either way.
export const menuIdOf = (x: IItem | ISplitItem | undefined) =>
  typeof x?.menuId === "string" ? x.menuId : x?.menuId?._id;

// Units of an item not paid for yet.
export const unpaidQty = (item: IItem | undefined) => (item?.qty ?? 0) - (item?.qtyPayed ?? 0);

// A diner's open split of an item (at most one per diner and item).
export const myOpenSplit = (split: ISplitItem[], myUserId: string, menuId: string | undefined) =>
  split.find((s) => s.splitStatus === "open" && s.userId === myUserId && menuIdOf(s) === menuId);

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
  return unpaidQty(item) - heldByOthers;
};

// A menu item the shop has marked unavailable. Only a populated menuId can
// say so; a bare id string (or a missing one) is treated as still available.
// The BE refuses to add, newly split or charge a sold-out item, so the UI
// greys it out and keeps it out of totals rather than letting a click 409.
export const isSoldOut = (x: IItem | ISplitItem | undefined) =>
  typeof x?.menuId === "object" && x.menuId?.available === false;

