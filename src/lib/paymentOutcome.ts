import type { FeedbackVariant } from "../components/Customers/PaymentFeedback/PaymentFeedback";
import { captureStripeCheckout, type CartRejection } from "../redux/slices/cartSlice";
import type { AppDispatch } from "../redux/app/store";
import { CART_GONE_MARKER, REFUNDED_MARKER } from "./cart";

// How a checkout ended, for the diner: the same mapping for PayPal's
// captureCheckout and Stripe's captureStripeCheckout.

export type CheckoutProvider = "paypal" | "stripe";

export interface PaymentOutcome {
  variant: FeedbackVariant;
  message?: string;
  // The table's cart is fetched again: it shows why the payment was refused
  // (a sold-out item, a selection staff released, a closed table).
  refetch: boolean;
  // A card payment not settled yet, which Stripe's webhook or the sweep
  // finishes: the cart is looked at again a little later (see Cart.tsx).
  recheck?: boolean;
}

// The provider took it but hasn't confirmed it: not paid yet, and not to be
// paid again. The items are held meanwhile.
const PENDING: Record<CheckoutProvider, string> = {
  paypal:
    "PayPal is still reviewing your payment. Your items are held for you until staff confirm it — please don't pay for them again.",
  stripe: "Stripe is still confirming your payment. Your items are held for you — please don't pay for them again.",
};

// The BE refused to start the payment (createCheckoutOrder,
// createStripeCheckout): nothing was charged. Whatever stopped it (a sold-out
// item, a selection staff released, a closed table), the cart as it is now
// shows why and stops offering the same checkout again.
export const notStartedOutcome = (rejection: CartRejection | undefined): PaymentOutcome => ({
  variant: "failure",
  message: rejection?.message
    ? `${rejection.message} — nothing was charged.`
    : "Payment failed — nothing was charged. Please try again.",
  refetch: true,
});

// The BE answered 200 (paid) or 202 (pending).
export const paidOutcome = (provider: CheckoutProvider, pending: boolean): PaymentOutcome =>
  pending
    ? { variant: "pending", message: PENDING[provider], refetch: false, recheck: provider === "stripe" }
    : { variant: "success", refetch: false };

// A card payment its capture couldn't ask about: the diner's session is over.
// The card may be authorised, and Stripe's webhook then finishes it as if
// they'd waited, so it may still be taken.
const NO_ANSWER =
  "We couldn't hear back about your card payment. Your cart will update once it's confirmed, and you'll get a note if it doesn't go through — until then, please don't pay for these items again.";
const SIGNED_OUT =
  "We couldn't check your card payment because you're signed out. Sign in to see how it went — until then, please don't pay for these items again.";

// The BE refused it, or didn't answer.
export const refusedOutcome = (
  rejection: CartRejection | undefined,
  provider: CheckoutProvider
): PaymentOutcome => {
  const status = rejection?.status;
  const message = rejection?.message;
  if (provider === "stripe" && (status === 401 || status === 403)) {
    return { variant: "confirming", message: SIGNED_OUT, refetch: false, recheck: true };
  }
  if (status === 409 && (!message || message.includes(REFUNDED_MARKER))) {
    // The cart changed after capture: the BE has already refunded it, and its
    // message says so.
    return {
      variant: "failure",
      message: message ? `${message}.` : "Someone else claimed those units first — you've been refunded automatically.",
      refetch: true,
    };
  }
  if (status === 402) {
    return {
      variant: "failure",
      message: "Payment could not be completed — nothing was charged. Please try again.",
      refetch: false,
    };
  }
  if (status === 404 && message?.includes(CART_GONE_MARKER)) {
    // A card payment that went through, or is being confirmed, on a cart
    // deleted since: said as it is, never "nothing was charged".
    return { variant: message.includes("being confirmed") ? "pending" : "success", message, refetch: true };
  }
  if (status !== undefined && status >= 400 && status < 500) {
    // Refused before capture: an item sold out, the selection changed or is
    // gone, the units were taken, the table was closed, or the login expired.
    // Nothing was charged; the refreshed cart shows why.
    return {
      variant: "failure",
      message: message ? `${message} — nothing was charged.` : "Payment could not be completed — nothing was charged.",
      refetch: true,
    };
  }
  if (rejection?.reason === "STILL_CONFIRMING" && message) {
    // A card payment the BE can't tell about yet: Stripe's webhook or its
    // sweep finishes it, and the diner gets a note of how. Its message says
    // so, and not to pay again; nothing is promised as held.
    return { variant: "confirming", message, refetch: false, recheck: true };
  }
  // A 5xx or no answer: the money may have moved. The BE's own message asks
  // the diner to contact staff, or (a card payment they dispute) says their
  // bank returns it, and gives the id staff need: shown as it is. An
  // unexposed error says only "Generic Server Error".
  const explained = !!message && (message.includes("contact staff") || message.includes("(payment "));
  if (provider === "stripe" && !explained) {
    // No answer from the BE (a dropped connection, a proxy's timeout): the
    // card may be authorised, and Stripe's webhook or the sweep finishes it
    // and leaves the diner a note, as for STILL_CONFIRMING.
    return { variant: "confirming", message: NO_ANSWER, refetch: false, recheck: true };
  }
  return {
    variant: "failure",
    message: explained ? message : "We couldn't confirm your payment — please contact staff before paying again.",
    refetch: false,
  };
};

// Card checkout, step 2, as both the sheet and the return from a bank check
// ask it: the BE's answer as the diner reads it.
export const captureCardPayment = (
  dispatch: AppDispatch,
  args: { tableId: string; cartId: string; paymentIntentId: string }
): Promise<PaymentOutcome> =>
  dispatch(captureStripeCheckout(args))
    .unwrap()
    .then(
      ({ pending }) => paidOutcome("stripe", pending),
      (err: unknown) => refusedOutcome(err as CartRejection | undefined, "stripe")
    );
