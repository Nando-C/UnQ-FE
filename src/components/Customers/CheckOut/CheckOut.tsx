import type { FeedbackVariant } from "../PaymentFeedback/PaymentFeedback";
import { lazy, Suspense, useRef, useState } from "react";
import { Offcanvas } from "react-bootstrap";
import { useParams } from "react-router-dom";
import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  captureCheckout,
  createCheckoutOrder,
  getTableCart,
  selectCartsData,
  type CartRejection,
} from "../../../redux/slices/cartSlice";
import { cancelledOutcome, notStartedOutcome, paidOutcome, refusedOutcome, type PaymentOutcome } from "../../../lib/paymentOutcome";
import { LOADING_CARD, stripeKey } from "../../../lib/stripe";
import { cartPath } from "../../../lib/paths";
import { formatPrice, fromPence, toPence } from "../../../lib/price";

// Stripe's React bindings, in their own chunk: only diners who open the sheet
// (with a key set) need them, and Stripe.js itself loads then too.
const CardPayment = lazy(() => import("./CardPayment"));

interface CheckOutProps {
  show: boolean;
  handleClose: () => void;
  // `recheck`: look at the cart again a little later (a card payment not
  // settled yet).
  handleShowFbk: (variant: FeedbackVariant, message?: string, recheck?: boolean) => void;
  // The diner's selection as they see it, in pounds.
  amount: number;
}

type Method = "card" | "paypal";

// The checkout sheet: when a publishable key is set, the card form first
// (Stripe's, its Card row open as the sheet opens; Apple Pay or Google Pay
// as rows under it where the device has them), then "or" and PayPal's
// button. Without a key PayPal is the only way. Each provider's script loads
// when the sheet opens.
const CheckOut = ({ show, handleClose, handleShowFbk, amount }: CheckOutProps) => {
  const cart = useAppSelector(selectCartsData);
  const dispatch = useAppDispatch();
  const { shopId = "", tableId = "" } = useParams<{ shopId: string; tableId: string }>();
  const createOrderRejectionRef = useRef<CartRejection | undefined>(undefined);
  const cardsOn = !!stripeKey();
  // The payment under way, if one is: a card being paid (its bank check may
  // be open over the page: the sheet can't be closed until its outcome is
  // known), or PayPal's popup open (from its order until approved, cancelled
  // or failed). Never both: each is disabled while the other is under way.
  const [busy, setBusy] = useState<Method | null>(null);

  // Amounts in pence. Stripe's form needs a positive one, so it keeps the
  // last positive amount when the selection empties under it (staff released
  // it, seen on a refetch), and Pay then says there's nothing to pay for.
  const pence = toPence(amount);
  const [lastPence, setLastPence] = useState(pence);
  if (pence > 0 && pence !== lastPence) setLastPence(pence);
  // A card press under way: the amount pressed stays shown, and in Stripe's
  // form, until it ends, whatever a refetch meanwhile finds (it's the amount
  // the BE's is checked against).
  const [pressed, setPressed] = useState<number | null>(null);
  const shownPence = pressed ?? pence;

  // How a payment ended: the sheet closes and says so. The cart shown is on
  // the payment's table (moving to another unmounts the sheet).
  const showOutcome = ({ variant, message, refetch, recheck }: PaymentOutcome) => {
    setBusy(null);
    setPressed(null);
    handleClose();
    handleShowFbk(variant, message, recheck);
    if (refetch) dispatch(getTableCart(cart.tableId));
  };

  return (
    <div className="CheckOut">
      <Offcanvas
        className="bottom-sheet"
        placement="bottom"
        show={show}
        onHide={() => {
          if (busy === "card") return;
          setBusy(null);
          handleClose();
        }}
      >
        <Offcanvas.Header closeButton={busy !== "card"}>
          <Offcanvas.Title>Select Payment Type</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {/* PayPal's button carries no amount: what's paid is said here, for
              both ways. */}
          {shownPence > 0 && (
            <p className="text-body-secondary small mb-3">
              {`Paying ${formatPrice(fromPence(shownPence))} for your selection`}
            </p>
          )}
          {show && (
            <PayPalScriptProvider
              options={{
                clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "sb",
                currency: "GBP",
              }}
            >
              {cardsOn && (
                <>
                  {/* Said once as a live region, by the card form itself
                      while Stripe.js loads; here only to be seen. */}
                  <Suspense fallback={<p className="text-body-secondary small mb-0">{LOADING_CARD}</p>}>
                    <CardPayment
                      tableId={cart.tableId}
                      cartId={cart._id}
                      pence={pence}
                      formPence={pressed ?? lastPence}
                      cartPath={cartPath(shopId, tableId)}
                      onOutcome={showOutcome}
                      onPress={(paying) => {
                        setPressed(paying);
                        setBusy(paying === null ? null : "card");
                      }}
                      disabled={busy === "paypal"}
                    />
                  </Suspense>
                  <p className="or-divider text-body-secondary small my-3" aria-hidden>
                    <span>or</span>
                  </p>
                </>
              )}
              <PayPalButtons
                // Under the card form, PayPal's own button only, one row
                // high: no Pay Later, and no card through PayPal (a card goes
                // through Stripe, above). Without a Stripe key PayPal's
                // buttons as it draws them, card button included (only in its
                // vertical layout): the only way to pay by card then.
                {...(cardsOn && { fundingSource: "paypal", style: { layout: "horizontal", height: 48, label: "paypal", tagline: false } })}
                // Not a second payment while a card's is being paid.
                disabled={busy === "card"}
                createOrder={async () => {
                  createOrderRejectionRef.current = undefined;
                  setBusy("paypal");
                  try {
                    return await dispatch(
                      createCheckoutOrder({
                        tableId: cart.tableId,
                        cartId: cart._id,
                      })
                    ).unwrap();
                  } catch (err) {
                    // The SDK's onError only gets a generic Error, so stash
                    // the BE's {status, message} here for onError to read.
                    createOrderRejectionRef.current = err as CartRejection | undefined;
                    throw err;
                  }
                }}
                onApprove={async (data) => {
                  try {
                    const { pending } = await dispatch(
                      captureCheckout({
                        tableId: cart.tableId,
                        cartId: cart._id,
                        paypalOrderId: data.orderID,
                      })
                    ).unwrap();
                    showOutcome(paidOutcome("paypal", pending));
                  } catch (err) {
                    showOutcome(refusedOutcome(err as CartRejection | undefined, "paypal"));
                  }
                }}
                onCancel={() => showOutcome(cancelledOutcome)}
                onError={() => showOutcome(notStartedOutcome(createOrderRejectionRef.current))}
              />
            </PayPalScriptProvider>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
};

export default CheckOut;
