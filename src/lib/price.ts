// Every price in the app, customer and manager side, goes through this, so they
// all read the same: "£9.50", never "£ 9.5" or "£31.5". Render the result with
// `text-nowrap` so the symbol can't wrap away from the amount.
const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export const formatPrice = (amount: number | null | undefined) =>
  gbp.format(amount ?? 0);
