import type { PaymentProvider } from "../typings/tables";

// A payment provider as staff and diners read it (a payment's `provider`): its
// name, and where its refunds go back to (a card's to the card, PayPal's to
// the diner's account).
const PROVIDERS: Record<PaymentProvider, { name: string; refundsTo: "card" | "account" }> = {
  paypal: { name: "PayPal", refundsTo: "account" },
  stripe: { name: "Stripe", refundsTo: "card" },
};
const known = (provider: string | undefined) => PROVIDERS[provider as PaymentProvider] as (typeof PROVIDERS)[PaymentProvider] | undefined;

// One it doesn't know is named as recorded, capitalised: it may start a
// sentence ("Adyen didn't complete…").
export const providerName = (provider: string | undefined) =>
  known(provider)?.name ?? (provider ? provider[0].toUpperCase() + provider.slice(1) : "Payment provider");

export const refundDestination = (provider: string | undefined) => known(provider)?.refundsTo ?? "account";
