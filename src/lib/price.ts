// Every price in the app, customer and manager side, goes through this, so they
// all read the same: "£9.50", never "£ 9.5" or "£31.5". Render the result with
// `text-nowrap` so the symbol can't wrap away from the amount.
const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export const formatPrice = (amount: number | null | undefined) =>
  gbp.format(amount ?? 0);

// Money in whole pence, as Stripe and the BE count it. Prices are pounds, and
// a total summed from them is a float (3 × £4.10 is 12.2999…), so every
// comparison with the BE's amount goes through this.
export const toPence = (pounds: number) => Math.round(pounds * 100);
export const fromPence = (pence: number) => pence / 100;
