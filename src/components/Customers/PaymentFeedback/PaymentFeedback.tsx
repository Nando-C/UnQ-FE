import { Card, Offcanvas, Row } from "react-bootstrap";
import { AiOutlineCheckCircle, AiOutlineClockCircle, AiOutlineCloseCircle } from "react-icons/ai";
import "./PaymentFeedback.css";

// "pending": PayPal took the payment but is still reviewing it, so it's
// neither a success nor a failure.
export type FeedbackVariant = "success" | "failure" | "pending";

const TITLES: Record<FeedbackVariant, string> = {
  success: "Payment successful",
  failure: "Payment not completed",
  pending: "Payment under review",
};

const ICONS: Record<FeedbackVariant, React.ReactNode> = {
  success: <AiOutlineCheckCircle color="var(--bs-success)" size={100} />,
  failure: <AiOutlineCloseCircle color="var(--bs-danger)" size={100} />,
  pending: <AiOutlineClockCircle color="var(--bs-warning)" size={100} />,
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
              <Card.Subtitle className="mt-4 text-center">
                {variant === "success" ? "Your payment went through." : message}
              </Card.Subtitle>
            </Row>
          </Offcanvas.Body>
        </Offcanvas>
      </div>
    </>
  );
};

export default PaymentFeedback;
