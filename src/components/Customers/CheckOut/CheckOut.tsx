import { Offcanvas } from "react-bootstrap";
import "./CheckOut.css";
import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { checkOutItem, selectCartsData } from "../../../redux/slices/cartSlice";

interface CheckOutProps {
  show: boolean;
  handleClose: () => void;
  total: number;
  handleShowFbk: (variant: "success" | "failure", message?: string) => void;
}

const CheckOut = ({
  show,
  handleClose,
  total,
  handleShowFbk,
}: CheckOutProps) => {
  const cart = useAppSelector(selectCartsData);
  const dispatch = useAppDispatch();

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
                createOrder={(data, actions) =>
                  actions.order.create({
                    intent: "CAPTURE",
                    purchase_units: [
                      {
                        amount: {
                          value: total.toFixed(2),
                          currency_code: "GBP",
                        },
                      },
                    ],
                  })
                }
                onApprove={async (data, actions) => {
                  try {
                    await actions.order?.capture();
                  } catch {
                    handleClose();
                    handleShowFbk(
                      "failure",
                      "Payment failed — nothing was charged. Please try again."
                    );
                    return;
                  }
                  cart.split
                    .filter((i) => i.splitStatus === "open")
                    .map((item) =>
                      dispatch(
                        checkOutItem({
                          shopId: "",
                          tableId: cart.tableId,
                          cartId: cart._id,
                          item: item,
                        })
                      )
                    );
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
                  handleShowFbk(
                    "failure",
                    "Payment failed — nothing was charged. Please try again."
                  );
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
