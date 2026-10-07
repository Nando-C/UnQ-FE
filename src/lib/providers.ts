// A payment provider as staff and diners read it (a payment's `provider`).
const NAMES: Record<string, string> = { paypal: "PayPal", stripe: "Stripe" };

// One it doesn't know is named as recorded, capitalised: it may start a
// sentence ("Adyen didn't complete…").
export const providerName = (provider: string | undefined) =>
  NAMES[provider ?? ""] ?? (provider ? provider[0].toUpperCase() + provider.slice(1) : "Payment provider");

// Where a refund goes back to, for staff: a card's to the card, PayPal's to
// the diner's account.
export const refundDestination = (provider: string | undefined) => (provider === "stripe" ? "card" : "account");
