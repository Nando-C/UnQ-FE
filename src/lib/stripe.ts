import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";

// Stripe's card payments (UnQ-BE's createStripeCheckout / captureStripeCheckout).
// Without a publishable key the card option isn't offered and PayPal works as
// before. Read when asked, not at import, so tests can set it.
export const stripeKey = (): string => import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";

// Stripe.js, loaded on first use (the "pure" entry doesn't load it on import):
// only once a diner opens the checkout sheet. A failed load is forgotten, so
// opening the sheet again retries it.
let stripePromise: Promise<Stripe | null> | undefined;
export const getStripe = (): Promise<Stripe | null> =>
  (stripePromise ??= loadStripe(stripeKey()).catch((err: unknown) => {
    stripePromise = undefined;
    throw err;
  }));

// A confirmPayment error that leaves the payment where it was, so the diner
// can try another card on the same intent: a decline, a form error, or a bank
// check that failed or was abandoned (which Stripe.js reports as an
// invalid_request_error). Anything else may come after the card was
// authorised, so the backend is asked how it ended.
export const isRetryableCardError = (error: { type?: string; code?: string }) =>
  error.type === "card_error" ||
  error.type === "validation_error" ||
  error.code === "payment_intent_authentication_failure";

// Where Stripe sends the diner back if a bank check takes them away from the
// page (rare: Stripe.js runs it over the page). Absolute, as Stripe requires,
// and it names the cart, as the reloaded page no longer has it.
const CART_PARAM = "cart";
export const stripeReturnUrl = (cartPath: string, cartId: string) =>
  `${window.location.origin}${cartPath}?${CART_PARAM}=${encodeURIComponent(cartId)}`;
// The return as the cart page finds it: the cart named above, and the payment
// Stripe adds (`payment_intent`). Null when the page wasn't returned to.
export const stripeReturn = (params: URLSearchParams) => {
  const cartId = params.get(CART_PARAM);
  return cartId ? { cartId, paymentIntentId: params.get("payment_intent") } : null;
};
