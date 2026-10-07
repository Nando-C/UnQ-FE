import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "react-bootstrap";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { useAppDispatch } from "../../../redux/app/hooks";
import { createStripeCheckout, type CartRejection } from "../../../redux/slices/cartSlice";
import { getStripe, isRetryableCardError, stripeReturnUrl } from "../../../lib/stripe";
import { captureCardPayment, notStartedOutcome, type PaymentOutcome } from "../../../lib/paymentOutcome";
import { formatPrice } from "../../../lib/price";

interface CardPaymentProps {
  tableId: string;
  cartId: string;
  // What the diner sees they're paying (their selection); the BE charges its
  // own total for it.
  amount: number;
  // The cart page's path, where a bank check that leaves the page returns.
  cartPath: string;
  // How it ended. Called once per payment: the sheet closes and shows it, and
  // opening the sheet again starts a new payment.
  onOutcome: (outcome: PaymentOutcome) => void;
  // While a card is being confirmed and the outcome asked for: the sheet
  // stays open until it's known.
  onBusy: (busy: boolean) => void;
  // While another payment (PayPal's popup) is under way.
  disabled: boolean;
}

// A ready payment keeps the cart, table and amount it was made for: the cart
// shown can change under the open sheet (refetched on focus), and the payment
// is captured on its own cart, never the new one.
type Start =
  | { kind: "loading" }
  | {
      kind: "ready";
      stripe: Stripe;
      clientSecret: string;
      paymentIntentId: string;
      tableId: string;
      cartId: string;
      amount: number;
    }
  | { kind: "failed" };

const CANT_START = "Card payments aren't available right now. Try again, or pay with PayPal below.";

// "Pay by card" in the checkout sheet: Stripe's Payment Element (Apple Pay and
// Google Pay too, where the device has them), for a payment created when the
// sheet opens. Confirming it only authorises the card; the BE then re-checks
// the cart and takes the money, or cancels the authorisation.
const CardPayment = ({ tableId, cartId, amount, cartPath, onOutcome, onBusy, disabled }: CardPaymentProps) => {
  const dispatch = useAppDispatch();
  const [start, setStart] = useState<Start>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The attempt already started: React runs effects twice in development, and
  // each start creates a payment at Stripe.
  const startedRef = useRef(-1);
  const intentRef = useRef<{
    tableId: string;
    cartId: string;
    amount: number;
    intent: { clientSecret: string; paymentIntentId: string };
  } | null>(null);
  const onOutcomeRef = useRef(onOutcome);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onOutcomeRef.current = onOutcome;
    disabledRef.current = disabled;
  });
  // Whether the sheet is still open: a start answered after it closed says
  // nothing (the diner may be paying with PayPal by then). Set again on
  // React's development remount.
  const openRef = useRef(true);
  useEffect(() => {
    openRef.current = true;
    return () => {
      openRef.current = false;
    };
  }, []);
  // Started once per attempt, with the cart as shown then (when the sheet
  // opened, or Try again was pressed): a later change to it doesn't restart
  // it, and the payment keeps what it was made for.
  useEffect(() => {
    if (startedRef.current === attempt) return;
    startedRef.current = attempt;
    // A payment already made for this cart is reused when only Stripe.js
    // failed: each start counts against the diner's per-minute edits.
    const kept = intentRef.current;
    const made = kept && kept.cartId === cartId && kept.tableId === tableId ? kept : { tableId, cartId, amount };
    const asked =
      kept === made
        ? Promise.resolve(kept.intent)
        : dispatch(createStripeCheckout({ tableId, cartId }))
            .unwrap()
            .then((created) => {
              intentRef.current = { ...made, intent: created };
              return created;
            });
    Promise.all([getStripe(), asked])
      .then(([stripe, { clientSecret, paymentIntentId }]) => {
        if (!openRef.current) return;
        const { tableId, cartId, amount } = made;
        setStart(stripe ? { kind: "ready", stripe, clientSecret, paymentIntentId, tableId, cartId, amount } : { kind: "failed" });
      })
      .catch((err: unknown) => {
        if (!openRef.current) return;
        const rejection = err as CartRejection | undefined;
        const status = rejection?.status;
        // Not while PayPal's popup is open: closing the sheet would end that
        // payment, which the BE may still take.
        if (status !== undefined && status >= 400 && status < 500 && status !== 429 && !disabledRef.current) {
          // The BE's checks refused it (a sold-out item, a selection staff
          // released, a closed table): PayPal would be refused too.
          onOutcomeRef.current(notStartedOutcome(rejection));
        } else {
          // Stripe or its script unreachable, or too many starts in a minute
          // (the BE limits them with the diner's edits): PayPal may still work.
          setStart({ kind: "failed" });
        }
      });
  }, [attempt, dispatch, tableId, cartId, amount]);

  // Asked whatever confirming said (but a decline the diner can retry): the
  // answer comes from the payment as Stripe has it.
  const capture = async ({ tableId, cartId, paymentIntentId }: { tableId: string; cartId: string; paymentIntentId: string }) =>
    onOutcomeRef.current(await captureCardPayment(dispatch, { tableId, cartId, paymentIntentId }));

  return (
    <section className="card-payment" aria-labelledby="card-payment-title">
      <h2 id="card-payment-title" className="h6">
        Pay by card
      </h2>
      {start.kind === "ready" ? (
        <Elements stripe={start.stripe} options={{ clientSecret: start.clientSecret }}>
          <CardForm
            amount={start.amount}
            returnUrl={stripeReturnUrl(cartPath, start.cartId)}
            onConfirmed={() => capture(start)}
            onBusy={onBusy}
            disabled={disabled}
            onLoadError={() => setStart({ kind: "failed" })}
          />
        </Elements>
      ) : start.kind === "failed" ? (
        <Alert variant="warning" className="py-2">
          <p className="mb-2">{CANT_START}</p>
          <Button
            variant="outline-primary"
            onClick={() => {
              setStart({ kind: "loading" });
              setAttempt((a) => a + 1);
            }}
          >
            Try again
          </Button>
        </Alert>
      ) : (
        <p className="text-body-secondary small" role="status">
          Loading card payment…
        </p>
      )}
    </section>
  );
};

interface CardFormProps {
  amount: number;
  returnUrl: string;
  onConfirmed: () => Promise<void>;
  onLoadError: () => void;
  onBusy: (busy: boolean) => void;
  disabled: boolean;
}

const CardForm = ({ amount, returnUrl, onConfirmed, onLoadError, onBusy, disabled }: CardFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  // Set at once, not on the next render: a double tap sends one payment.
  const sendingRef = useRef(false);
  // Why the last try was declined, under the form.
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || disabled || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    onBusy(true);
    setError(null);
    let failure: { type?: string; code?: string; message?: string } | undefined;
    try {
      // Stripe.js runs a bank check over the page; only one that has to take
      // the diner away comes back through returnUrl (the cart page).
      ({ error: failure } = await stripe.confirmPayment({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: returnUrl },
      }));
    } catch {
      // No answer: the card may have been authorised.
      failure = { type: "api_connection_error" };
    }
    if (failure && isRetryableCardError(failure)) {
      // Nothing was authorised: the diner can try another card on this
      // payment. A form error (an incomplete number) already shows in
      // Stripe's form, next to its field.
      setError(failure.type === "validation_error" ? null : (failure.message ?? "Your card was declined. Try another card."));
      sendingRef.current = false;
      setSending(false);
      onBusy(false);
      return;
    }
    // Stays sending: whatever the answer, the sheet closes with it.
    await onConfirmed();
    onBusy(false);
  };

  return (
    <form onSubmit={submit} noValidate>
      <PaymentElement onReady={() => setReady(true)} onLoadError={onLoadError} />
      {error && (
        <Alert variant="danger" className="mt-2 mb-0 py-2" role="alert">
          {error}
        </Alert>
      )}
      <div className="d-grid mt-3">
        <Button type="submit" disabled={!stripe || !elements || !ready || sending || disabled}>
          {sending ? "Paying…" : <>Pay <strong>{formatPrice(amount)}</strong></>}
        </Button>
      </div>
    </form>
  );
};

export default CardPayment;
