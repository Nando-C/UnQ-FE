import { IItem, ISplitItem } from "../typings/cart";

// Cart/split entries carry menuId either populated (object) or as a bare id
// string depending on which BE response last landed in the store.
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

// The one 409 from captureCheckout that comes AFTER the money moved: a
// concurrent payer took the units and the BE refunded the capture. Every other
// 409 there (sold out, selection changed, not enough units left) is raised
// before capture, so nothing was charged. Matched by substring because the
// BE's message is the only thing that tells them apart.
export const REFUNDED_MARKER = "your payment was refunded";
