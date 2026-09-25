import { Card, Offcanvas, Row } from "react-bootstrap";
import { AiOutlineCheckCircle, AiOutlineCloseCircle } from "react-icons/ai";
import "./PaymentFeedback.css";

interface PaymentFeedbackProps {
  showFbk: boolean;
  variant: "success" | "failure";
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
        <Offcanvas placement="bottom" show={showFbk} onHide={handleCloseFbk}>
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>
              {variant === "success" ? "Success!" : "Payment not completed"}
            </Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Row>
              {variant === "success" ? (
                <>
                  <AiOutlineCheckCircle color="var(--bs-success)" size={100} />
                  <Card.Subtitle className="mt-4 text-center">
                    The Transaction Was Successful!
                  </Card.Subtitle>
                </>
              ) : (
                <>
                  <AiOutlineCloseCircle color="var(--bs-danger)" size={100} />
                  <Card.Subtitle className="mt-4 text-center">
                    {message}
                  </Card.Subtitle>
                </>
              )}
            </Row>
          </Offcanvas.Body>
        </Offcanvas>
      </div>
    </>
  );
};

export default PaymentFeedback;
