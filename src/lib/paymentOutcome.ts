import type { FeedbackVariant } from "../components/Customers/PaymentFeedback/PaymentFeedback";
import type { PaymentProvider } from "../typings/tables";
import { captureStripeCheckout, type CartRejection } from "../redux/slices/cartSlice";
import type { AppDispatch } from "../redux/app/store";

// How a checkout ended, for the diner: the same mapping for PayPal's
// captureCheckout and Stripe's captureStripeCheckout, and every wording the
// diner sees about it.

// The BE's wording this mapping relies on (its messages are the only thing
// that tells these answers apart; see UnQ-BE's README for each route):
// - captureCheckout's one 409 from AFTER the money moved: a concurrent payer
//   took the units and the BE refunded the capture. Every other 409 there
//   (sold out, selection changed, not enough units left) is raised before
//   capture, so nothing was charged.
const refundedAfterCapture = (status: number | undefined, message: string | undefined) =>
  status === 409 && (!message || message.includes("your payment was refunded"));
// - captureStripeCheckout's 404 for a card payment that went through (or is
//   being confirmed) when the table's cart was deleted since (with its table
//   or shop): never "nothing was charged". Every other 404 there is raised
//   before anything was taken.
const CART_GONE_MARKER = "this table's cart is no longer here";
// - A 5xx whose message explains itself: the BE asks the diner to contact
//   staff, or (a card payment they dispute) says their bank returns it, and
//   gives the id staff need. An unexposed error says only "Generic Server Error".
const explainsItself = (message: string | undefined) =>
  !!message && (message.includes("contact staff") || message.includes("(payment "));

// What each provider's checkout is like: what the diner is told while it holds
// a payment it hasn't confirmed, and whether a payment the diner's own request
// didn't hear about is finished without them (a card's, by Stripe's webhook or
// the sweep: an unanswered capture is "confirming", looked at again later,
// not a failure).
const PROVIDERS: Record<PaymentProvider, { pending: string; finishesUnattended: boolean }> = {
  paypal: {
    pending:
      "PayPal is still reviewing your payment. Your items are held for you until staff confirm it — please don't pay for them again.",
    finishesUnattended: false,
  },
  stripe: {
    pending: "Stripe is still confirming your payment. Your items are held for you — please don't pay for them again.",
    finishesUnattended: true,
  },
};

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

// A 4xx from a checkout step: the BE's checks refused it before anything was
// charged (an item sold out, the selection changed or is gone, the units were
// taken, the table was closed, or the login expired).
export const isRefusal = (status: number | undefined) => status !== undefined && status >= 400 && status < 500;

// Refused before anything was charged: the cart as it is now shows why (a
// sold-out item, a selection staff released, a closed table) and stops
// offering the same checkout again.
const notCharged = (message: string | undefined, fallback: string): PaymentOutcome => ({
  variant: "failure",
  message: message ? `${message} — nothing was charged.` : fallback,
  refetch: true,
});

// The BE refused to start the payment (createCheckoutOrder, createStripeCheckout).
export const notStartedOutcome = (rejection: CartRejection | undefined): PaymentOutcome =>
  notCharged(rejection?.message, "Payment failed — nothing was charged. Please try again.");

// The diner closed PayPal's popup.
export const cancelledOutcome: PaymentOutcome = { variant: "failure", message: "Payment cancelled — nothing was charged.", refetch: false };

// The BE answered 200 (paid) or 202 (pending: the provider took it but hasn't
// confirmed it, so not paid yet, and not to be paid again; the items are held).
export const paidOutcome = (provider: PaymentProvider, pending: boolean): PaymentOutcome =>
  pending
    ? { variant: "pending", message: PROVIDERS[provider].pending, refetch: false, recheck: PROVIDERS[provider].finishesUnattended }
    : { variant: "success", message: "Your payment went through.", refetch: false };

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
  provider: PaymentProvider
): PaymentOutcome => {
  const status = rejection?.status;
  const message = rejection?.message;
  const { finishesUnattended } = PROVIDERS[provider];
  if (finishesUnattended && (status === 401 || status === 403)) {
    return { variant: "confirming", message: SIGNED_OUT, refetch: false, recheck: true };
  }
  if (refundedAfterCapture(status, message)) {
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
  if (isRefusal(status)) return notCharged(message, "Payment could not be completed — nothing was charged.");
  if (rejection?.reason === "STILL_CONFIRMING" && message) {
    // A card payment the BE can't tell about yet: Stripe's webhook or its
    // sweep finishes it, and the diner gets a note of how. Its message says
    // so, and not to pay again; nothing is promised as held.
    return { variant: "confirming", message, refetch: false, recheck: true };
  }
  // A 5xx or no answer: the money may have moved. The BE's own message, when
  // it explains itself, is shown as it is.
  const explained = explainsItself(message);
  if (finishesUnattended && !explained) {
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
