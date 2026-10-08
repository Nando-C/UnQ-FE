import type { FeedbackVariant } from "../PaymentFeedback/PaymentFeedback";
import { lazy, Suspense, useRef, useState, type ReactNode } from "react";
import { Accordion, Offcanvas } from "react-bootstrap";
import { FiCreditCard } from "react-icons/fi";
import { IoWalletOutline } from "react-icons/io5";
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

// The checkout sheet: the ways to pay, as rows, none chosen when it opens; the
// chosen one's form opens beneath its row. By card (Stripe; Apple Pay and
// Google Pay where the device has them) when a publishable key is set, and
// PayPal. Without a key PayPal is the only way, shown at once. Each provider's
// script loads when the sheet opens, so a row opens without a wait.
const CheckOut = ({ show, handleClose, handleShowFbk, amount }: CheckOutProps) => {
  const cart = useAppSelector(selectCartsData);
  const dispatch = useAppDispatch();
  const { shopId = "", tableId = "" } = useParams<{ shopId: string; tableId: string }>();
  const createOrderRejectionRef = useRef<CartRejection | undefined>(undefined);
  const cardsOn = !!stripeKey();
  // The payment under way, if one is: a card being paid (its bank check may
  // be open over the page: the sheet can't be closed until its outcome is
  // known), or PayPal's popup open (from its order until approved, cancelled
  // or failed). The rows can't be changed meanwhile, so one can't start while
  // the other is under way, nor its form be closed under it.
  const [busy, setBusy] = useState<Method | null>(null);
  // The row open, chosen afresh each time the sheet opens.
  const [method, setMethod] = useState<Method | null>(null);
  const [wasShown, setWasShown] = useState(show);
  if (show !== wasShown) {
    setWasShown(show);
    if (!show) setMethod(null);
  }

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

  const paypalButtons = (
    <PayPalButtons
      // Beside the Card row, PayPal's own button only: no Pay Later, and no
      // card through PayPal (a card is the Card row's, through Stripe).
      // Without a Stripe key PayPal's card button stays: it's the only way to
      // pay by card then.
      fundingSource={cardsOn ? "paypal" : undefined}
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
  );

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
              {cardsOn ? (
                <Accordion flush activeKey={method} onSelect={(key) => setMethod(key as Method | null)}>
                  <MethodRow
                    eventKey="card"
                    icon={<FiCreditCard aria-hidden size={22} />}
                    title="Card"
                    detail="Debit or credit card · Apple Pay · Google Pay"
                    disabled={busy !== null}
                  >
                    <Suspense fallback={<p className="text-body-secondary small mb-0" role="status">Loading card payment…</p>}>
                      <CardPayment
                        open={method === "card"}
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
                  </MethodRow>
                  <MethodRow
                    eventKey="paypal"
                    icon={<IoWalletOutline aria-hidden size={22} />}
                    title="PayPal"
                    detail="Your PayPal account"
                    disabled={busy !== null}
                  >
                    {method === "paypal" && paypalButtons}
                  </MethodRow>
                </Accordion>
              ) : (
                paypalButtons
              )}
            </PayPalScriptProvider>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
};

interface MethodRowProps {
  eventKey: Method;
  icon: ReactNode;
  title: string;
  detail: string;
  disabled: boolean;
  children: ReactNode;
}

// One way to pay: a button that opens its form beneath it. Built from
// Accordion.Button rather than Accordion.Header, whose props land on the
// heading, not the button, so it couldn't be disabled.
const MethodRow = ({ eventKey, icon, title, detail, disabled, children }: MethodRowProps) => (
  <Accordion.Item eventKey={eventKey}>
    <h2 className="accordion-header">
      <Accordion.Button disabled={disabled} className="gap-3 px-2">
        {icon}
        <span>
          <span className="d-block fw-semibold">{title}</span>{" "}
          <span className="d-block small text-body-secondary">{detail}</span>
        </span>
      </Accordion.Button>
    </h2>
    <Accordion.Body className="px-2">{children}</Accordion.Body>
  </Accordion.Item>
);

export default CheckOut;
