import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert, Button } from "react-bootstrap";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Stripe, StripeElementsOptionsMode, StripePaymentElementOptions } from "@stripe/stripe-js";
import { useAppDispatch } from "../../../redux/app/hooks";
import { createStripeCheckout, getTableCart, type CartRejection } from "../../../redux/slices/cartSlice";
import { getStripe, isRetryableCardError, LOADING_CARD, stripeReturnUrl } from "../../../lib/stripe";
import { captureCardPayment, isRefusal, notStartedOutcome, type PaymentOutcome } from "../../../lib/paymentOutcome";
import { formatPrice, fromPence } from "../../../lib/price";

interface CardPaymentProps {
  // The cart shown now, which a press pays for.
  tableId: string;
  cartId: string;
  // The diner's selection now, in pence (0 when nothing is selected).
  pence: number;
  // The amount Stripe's form shows (wallet sheets too), in pence: the one
  // pressed during a press, else the last positive selection.
  formPence: number;
  // The cart page's path, where a bank check that leaves the page returns.
  cartPath: string;
  // How it ended. Called once per payment: the sheet closes and shows it, and
  // opening the sheet again starts afresh.
  onOutcome: (outcome: PaymentOutcome) => void;
  // A press starting (with its amount) and ending (null): the sheet stays
  // open, and the amount pressed shown, until it ends.
  onPress: (pence: number | null) => void;
  // While another payment (PayPal's popup) is under way.
  disabled: boolean;
}

const CANT_START = "Card payments aren't available right now. Try again, or choose PayPal.";
const COULDNT_START = "Couldn't start the card payment. Try again in a moment, or pay with PayPal.";
const NOTHING_SELECTED = "Nothing selected to pay for";
// Stripe's form lists each way to pay as a row: Card, then Apple Pay or
// Google Pay where the device and domain allow. Card comes first and is open
// as the sheet opens, with or without a wallet row (left to itself, Stripe
// opens it only when it's the sole row); one row is open at a time, and Pay
// pays with the open one. Spaced rows, no radios. No Link, Stripe's own
// saved-card wallet: it asks for an email to sign up.
const ELEMENT_OPTIONS: StripePaymentElementOptions = {
  layout: { type: "accordion", defaultCollapsed: false, radios: "never", spacedAccordionItems: true },
  paymentMethodOrder: ["card"],
  wallets: { link: "never" },
  // The venues are in the UK and charge in pounds, so the form starts on
  // United Kingdom (Stripe would otherwise guess from the diner's address);
  // a diner with a card from elsewhere changes it.
  defaultValues: { billingDetails: { address: { country: "GB" } } },
};

// The card form in the checkout sheet: Stripe's Payment Element (Apple Pay and
// Google Pay too, where the device has them, as rows under Card). Stripe.js
// loads, and the form shows, as the sheet opens. Nothing is created until the
// diner presses Pay (Stripe's deferred intent): then the BE creates the payment at
// its own prices, and it's confirmed only for the amount the diner saw.
// Confirming only authorises the card; the BE then re-checks the cart and
// takes the money, or cancels the authorisation.
const CardPayment = ({ tableId, cartId, pence, formPence, cartPath, onOutcome, onPress, disabled }: CardPaymentProps) => {
  // Stripe.js: loading (undefined), loaded, or failed. `attempt` loads it
  // again (Try again), and gives the form a fresh Elements.
  const [stripe, setStripe] = useState<Stripe | "failed" | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    getStripe().then(
      (loaded) => live && setStripe(loaded ?? "failed"),
      () => live && setStripe("failed")
    );
    return () => {
      live = false;
    };
  }, [attempt]);

  // The same object across renders: Elements compares its options each render,
  // and updates the amount when it changes. These match the BE's payment
  // (GBP, manual capture, cards only), as Stripe's deferred intent requires.
  const options = useMemo<StripeElementsOptionsMode>(
    () => ({ mode: "payment", amount: formPence, currency: "gbp", captureMethod: "manual", allowedPaymentMethodTypes: ["card"] }),
    [formPence]
  );

  if (stripe === "failed") {
    return (
      <Alert variant="warning" className="py-2 mb-0">
        <p className="mb-2">{CANT_START}</p>
        <Button
          variant="outline-primary"
          onClick={() => {
            setStripe(undefined);
            setAttempt((a) => a + 1);
          }}
        >
          Try again
        </Button>
      </Alert>
    );
  }
  // The sheet opens only on a selection (Check out is off without one), so
  // its form always has an amount; a refetch emptying the selection leaves
  // the form, and the amount it had, in place (`formPence`), and only Pay
  // says there's nothing to pay for. Stripe's form can't be made for nothing.
  if (formPence <= 0) return null;
  if (!stripe) {
    return (
      <p className="text-body-secondary small mb-0" role="status">
        {LOADING_CARD}
      </p>
    );
  }
  return (
    <Elements key={attempt} stripe={stripe} options={options}>
      <CardForm
        tableId={tableId}
        cartId={cartId}
        pence={pence}
        cartPath={cartPath}
        onOutcome={onOutcome}
        onPress={onPress}
        disabled={disabled}
        onLoadError={() => setStripe("failed")}
      />
    </Elements>
  );
};

interface CardFormProps {
  tableId: string;
  cartId: string;
  pence: number;
  cartPath: string;
  onOutcome: (outcome: PaymentOutcome) => void;
  onPress: (pence: number | null) => void;
  disabled: boolean;
  onLoadError: () => void;
}

const CardForm = ({ tableId, cartId, pence, cartPath, onOutcome, onPress, disabled, onLoadError }: CardFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const dispatch = useAppDispatch();
  const [ready, setReady] = useState(false);
  // Also disables Pay, so a double tap sends one payment (React flushes the
  // first tap's state before the second is dispatched).
  const [sending, setSending] = useState(false);
  // Why the last press didn't pay, under the form.
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || disabled || sending || pence <= 0) return;
    // First, before anything is awaited: Apple Pay and Google Pay open their
    // sheet from it, which needs the diner's tap. It also checks the form. A
    // form torn down meanwhile throws at once: said as an error like any other.
    let submitted: ReturnType<typeof elements.submit>;
    try {
      submitted = elements.submit();
    } catch {
      submitted = Promise.resolve({ error: { type: "api_error", message: COULDNT_START } }) as ReturnType<typeof elements.submit>;
    }
    // What this press pays for: the cart and amount shown now, whatever a
    // refetch meanwhile finds.
    const press = { tableId, cartId, pence };
    setSending(true);
    setError(null);
    onPress(press.pence);
    // Ends the press without paying, saying why under the form (nothing, for
    // an error Stripe's form already shows next to its field).
    const stop = (why: string | null) => {
      setError(why);
      setSending(false);
      onPress(null);
    };

    let formError: { type?: string; message?: string } | undefined;
    try {
      ({ error: formError } = await submitted);
    } catch {
      formError = { type: "api_connection_error" };
    }
    if (formError) return stop(formError.type === "validation_error" ? null : (formError.message ?? COULDNT_START));

    // A payment for this press alone, at the BE's prices then.
    let intent: { clientSecret: string; paymentIntentId: string; amount?: number };
    try {
      intent = await dispatch(createStripeCheckout({ tableId: press.tableId, cartId: press.cartId })).unwrap();
    } catch (err) {
      const rejection = err as CartRejection | undefined;
      // The BE's checks refused it (a sold-out item, a selection staff
      // released, a closed table): PayPal would be refused too, and the cart
      // as it is now says why.
      if (isRefusal(rejection?.status) && rejection?.status !== 429) return onOutcome(notStartedOutcome(rejection));
      // Too many starts in a minute, Stripe or the BE unreachable: nothing
      // was created, and the next press may work, or PayPal.
      return stop(COULDNT_START);
    }
    if (typeof intent.amount !== "number") return stop(COULDNT_START);
    if (intent.amount !== press.pence) {
      // The BE prices it differently (a price changed since the cart was
      // loaded): never confirmed. The cart is fetched again, so what's shown
      // follows the BE's prices; the payment is left for the BE to cancel.
      dispatch(getTableCart(press.tableId));
      return stop(`The total is now ${formatPrice(fromPence(intent.amount))} — check it and press Pay again.`);
    }

    let failure: { type?: string; code?: string; message?: string } | undefined;
    try {
      // Stripe.js runs a bank check over the page; only one that has to take
      // the diner away comes back through the return URL (the cart page).
      ({ error: failure } = await stripe.confirmPayment({
        elements,
        clientSecret: intent.clientSecret,
        redirect: "if_required",
        confirmParams: { return_url: stripeReturnUrl(cartPath, press.cartId) },
      }));
    } catch {
      // No answer: the card may have been authorised.
      failure = { type: "api_connection_error" };
    }
    if (failure && isRetryableCardError(failure)) {
      // Nothing was authorised: the diner can try another card, on a new
      // payment at the next press.
      return stop(failure.type === "validation_error" ? null : (failure.message ?? "Your card was declined. Try another card."));
    }
    // Asked whatever confirming said: the answer comes from the payment as
    // Stripe has it. Stays sending: whatever the answer, the sheet closes
    // with it.
    onOutcome(await captureCardPayment(dispatch, { tableId: press.tableId, cartId: press.cartId, paymentIntentId: intent.paymentIntentId }));
  };

  return (
    <form onSubmit={submit} noValidate>
      <PaymentElement options={ELEMENT_OPTIONS} onReady={() => setReady(true)} onLoadError={onLoadError} />
      {error && (
        <Alert variant="danger" className="mt-2 mb-0 py-2" role="alert">
          {error}
        </Alert>
      )}
      <div className="d-grid mt-3">
        <Button type="submit" disabled={!stripe || !elements || !ready || sending || disabled || pence <= 0}>
          {sending ? "Paying…" : pence > 0 ? <>Pay <strong>{formatPrice(fromPence(pence))}</strong></> : NOTHING_SELECTED}
        </Button>
      </div>
    </form>
  );
};

export default CardPayment;
