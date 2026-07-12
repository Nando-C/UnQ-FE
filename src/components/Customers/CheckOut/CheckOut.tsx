import { useRef } from "react";
import { Offcanvas } from "react-bootstrap";
import "./CheckOut.css";
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

interface CheckOutProps {
  show: boolean;
  handleClose: () => void;
  handleShowFbk: (variant: "success" | "failure", message?: string) => void;
}

const CheckOut = ({ show, handleClose, handleShowFbk }: CheckOutProps) => {
  const cart = useAppSelector(selectCartsData);
  const dispatch = useAppDispatch();
  const createOrderRejectionRef = useRef<
    { status?: number; message?: string } | undefined
  >(undefined);

  return (
    <div className="CheckOut">
      <Offcanvas placement="bottom" show={show} onHide={handleClose}>
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
                  try {
                    await dispatch(
                      captureCheckout({
                        tableId: cart.tableId,
                        cartId: cart._id,
                        paypalOrderId: data.orderID,
                      })
                    ).unwrap();
                  } catch (err) {
                    handleClose();
                    const rejection = err as
                      | { status?: number; message?: string }
                      | undefined;
                    if (rejection?.status === 409) {
                      // A concurrent payer took the units after capture — the
                      // BE has already refunded automatically.
                      handleShowFbk(
                        "failure",
                        rejection.message
                          ? `${rejection.message} — you've been refunded automatically.`
                          : "Someone else claimed those units first — you've been refunded automatically."
                      );
                    } else if (rejection?.status === 402) {
                      handleShowFbk(
                        "failure",
                        "Payment could not be completed — nothing was charged. Please try again."
                      );
                    } else {
                      handleShowFbk(
                        "failure",
                        rejection?.message
                          ? `Payment received, but the server rejected it (${rejection.message}) — please contact staff.`
                          : "Payment received, but confirming it with the server failed — please contact staff."
                      );
                    }
                    return;
                  }
                  handleShowFbk("success");
                  handleClose();
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
