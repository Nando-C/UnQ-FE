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
import { stripeKey } from "../../../lib/stripe";
import { cartPath } from "../../../lib/paths";

// Stripe's React bindings, in their own chunk: only diners who open the sheet
// (with a key set) need them, and Stripe.js itself loads then too.
const CardPayment = lazy(() => import("./CardPayment"));

interface CheckOutProps {
  show: boolean;
  handleClose: () => void;
  // `recheck`: look at the cart again a little later (a card payment not
  // settled yet).
  handleShowFbk: (variant: FeedbackVariant, message?: string, recheck?: boolean) => void;
  // The diner's selection as they see it, on the card's Pay button.
  amount: number;
}

// The checkout sheet: by card (Stripe; Apple Pay and Google Pay where the
// device has them) when a publishable key is set, then PayPal's buttons. Each
// script loads only once the sheet opens.
const CheckOut = ({ show, handleClose, handleShowFbk, amount }: CheckOutProps) => {
  const cart = useAppSelector(selectCartsData);
  const dispatch = useAppDispatch();
  const { shopId = "", tableId = "" } = useParams<{ shopId: string; tableId: string }>();
  const createOrderRejectionRef = useRef<CartRejection | undefined>(undefined);
  const cardsOn = !!stripeKey();
  // The payment under way, if one is: a card being confirmed (its bank check
  // may be open over the page: the sheet can't be closed until its outcome is
  // known), or PayPal's popup open (from its order until approved, cancelled
  // or failed). Never both: each is disabled while the other is busy.
  const [busy, setBusy] = useState<"card" | "paypal" | null>(null);

  // How a payment ended: the sheet closes and says so. The cart shown is on
  // the payment's table (moving to another unmounts the sheet).
  const showOutcome = ({ variant, message, refetch, recheck }: PaymentOutcome) => {
    setBusy(null);
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
          {show && cardsOn && (
            <>
              <Suspense fallback={<p className="text-body-secondary small" role="status">Loading card payment…</p>}>
                <CardPayment
                  tableId={cart.tableId}
                  cartId={cart._id}
                  amount={amount}
                  cartPath={cartPath(shopId, tableId)}
                  onOutcome={showOutcome}
                  onBusy={(cardBusy) => setBusy(cardBusy ? "card" : null)}
                  disabled={busy === "paypal"}
                />
              </Suspense>
              <p className="text-center text-body-secondary small my-3">or pay with PayPal</p>
            </>
          )}
          {show && (
            <PayPalScriptProvider
              options={{
                clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "sb",
                currency: "GBP",
              }}
            >
              <PayPalButtons
                // Not a second payment while a card's is being confirmed.
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
