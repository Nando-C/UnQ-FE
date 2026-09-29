import type { FeedbackVariant } from "../PaymentFeedback/PaymentFeedback";
import { useRef } from "react";
import { Offcanvas } from "react-bootstrap";
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
} from "../../../redux/slices/cartSlice";
import { REFUNDED_MARKER } from "../../../lib/cart";

interface CheckOutProps {
  show: boolean;
  handleClose: () => void;
  handleShowFbk: (variant: FeedbackVariant, message?: string) => void;
}

const CheckOut = ({ show, handleClose, handleShowFbk }: CheckOutProps) => {
  const cart = useAppSelector(selectCartsData);
  const dispatch = useAppDispatch();
  const createOrderRejectionRef = useRef<
    { status?: number; message?: string } | undefined
  >(undefined);

  return (
    <div className="CheckOut">
      <Offcanvas className="bottom-sheet" placement="bottom" show={show} onHide={handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Select Payment Type</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {show && (
            <PayPalScriptProvider
              options={{
                clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || "sb",
                currency: "GBP",
              }}
            >
              <PayPalButtons
                createOrder={async () => {
                  createOrderRejectionRef.current = undefined;
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
                    createOrderRejectionRef.current = err as
                      | { status?: number; message?: string }
                      | undefined;
                    throw err;
                  }
                }}
                onApprove={async (data) => {
                  let pending: boolean;
                  try {
                    ({ pending } = await dispatch(
                      captureCheckout({
                        tableId: cart.tableId,
                        cartId: cart._id,
                        paypalOrderId: data.orderID,
                      })
                    ).unwrap());
                  } catch (err) {
                    handleClose();
                    const rejection = err as
                      | { status?: number; message?: string }
                      | undefined;
                    if (
                      rejection?.status === 409 &&
                      rejection.message &&
                      !rejection.message.includes(REFUNDED_MARKER)
                    ) {
                      // Refused BEFORE capture (an item sold out, the
                      // selection changed, or the units are gone): nothing
                      // was charged or refunded. The refreshed cart shows why.
                      handleShowFbk(
                        "failure",
                        `${rejection.message} — nothing was charged.`
                      );
                      dispatch(getTableCart(cart.tableId));
                    } else if (rejection?.status === 409) {
                      // The cart changed after capture — the BE has already
                      // refunded automatically, and its message says so.
                      handleShowFbk(
                        "failure",
                        rejection.message
                          ? `${rejection.message}.`
                          : "Someone else claimed those units first — you've been refunded automatically."
                      );
                      dispatch(getTableCart(cart.tableId));
                    } else if (rejection?.status === 402) {
                      handleShowFbk(
                        "failure",
                        "Payment could not be completed — nothing was charged. Please try again."
                      );
                    } else if (
                      rejection?.status !== undefined &&
                      rejection.status >= 400 &&
                      rejection.status < 500
                    ) {
                      // Refused before capture: the table was closed, the
                      // selection is gone, or the login expired.
                      handleShowFbk(
                        "failure",
                        rejection.message
                          ? `${rejection.message} — nothing was charged.`
                          : "Payment could not be completed — nothing was charged."
                      );
                      dispatch(getTableCart(cart.tableId));
                    } else {
                      // A 5xx or no answer: the money may have moved. The BE's
                      // own message already asks the diner to contact staff
                      // and gives the order id they need; show it as it is.
                      handleShowFbk(
                        "failure",
                        rejection?.message?.includes("contact staff")
                          ? rejection.message
                          : "We couldn't confirm your payment — please contact staff before paying again."
                      );
                    }
                    return;
                  }
                  handleClose();
                  if (pending) {
                    // PayPal took it but is still reviewing it: not paid yet,
                    // and not to be paid again.
                    handleShowFbk(
                      "pending",
                      "PayPal is still reviewing your payment. Your items are held for you until staff confirm it — please don't pay for them again."
                    );
                    return;
                  }
                  handleShowFbk("success");
                }}
                onCancel={() => {
                  handleClose();
                  handleShowFbk(
                    "failure",
                    "Payment cancelled — nothing was charged."
                  );
                }}
                onError={() => {
                  handleClose();
                  const rejection = createOrderRejectionRef.current;
                  handleShowFbk(
                    "failure",
                    rejection?.message
                      ? `${rejection.message} — nothing was charged.`
                      : "Payment failed — nothing was charged. Please try again."
                  );
                  if (rejection?.status === 409) {
                    dispatch(getTableCart(cart.tableId));
                  }
                }}
              />
            </PayPalScriptProvider>
          )}
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
};

export default CheckOut;
