import { Card, Offcanvas, Row } from "react-bootstrap";
import { AiOutlineCheckCircle, AiOutlineClockCircle, AiOutlineCloseCircle } from "react-icons/ai";
import "./PaymentFeedback.css";

// "pending": the provider took the payment but hasn't confirmed it (PayPal
// reviewing it, Stripe processing it), so it's neither a success nor a
// failure. "confirming": a card payment the BE can't tell about yet; it
// finishes it, and the cart and a note say how.
export type FeedbackVariant = "success" | "failure" | "pending" | "confirming";

const TITLES: Record<FeedbackVariant, string> = {
  success: "Payment successful",
  failure: "Payment not completed",
  pending: "Payment under review",
  confirming: "Confirming your payment",
};

const clock = <AiOutlineClockCircle color="var(--bs-warning)" size={100} />;
const ICONS: Record<FeedbackVariant, React.ReactNode> = {
  success: <AiOutlineCheckCircle color="var(--bs-success)" size={100} />,
  failure: <AiOutlineCloseCircle color="var(--bs-danger)" size={100} />,
  pending: clock,
  confirming: clock,
};

interface PaymentFeedbackProps {
  showFbk: boolean;
  variant: FeedbackVariant;
  message?: string;
  handleCloseFbk: () => void;
}

const PaymentFeedback = ({
  showFbk,
  variant,
  message,
  handleCloseFbk,
}: PaymentFeedbackProps) => {
  return (
    <>
      <div className="CheckOut">
        <Offcanvas className="bottom-sheet" placement="bottom" show={showFbk} onHide={handleCloseFbk}>
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>
              {TITLES[variant]}
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Row>
              {ICONS[variant]}
              <Card.Subtitle className="mt-4 text-center">{message}</Card.Subtitle>
            </Row>
          </Offcanvas.Body>
        </Offcanvas>
      </div>
    </>
  );
};

export default PaymentFeedback;
