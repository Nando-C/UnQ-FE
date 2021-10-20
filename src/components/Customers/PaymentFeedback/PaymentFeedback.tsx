import { Card, Offcanvas, Row } from "react-bootstrap";
import { AiOutlineCheckCircle } from "react-icons/ai";
import "./PaymentFeedback.css";

interface PaymentFeedbackProps {
  showFbk: boolean;
  handleCloseFbk: () => void;
}

const PaymentFeedback = ({ showFbk, handleCloseFbk }: PaymentFeedbackProps) => {
  return (
    <>
      <div className="CheckOut">
        <Offcanvas placement="bottom" show={showFbk} onHide={handleCloseFbk}>
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>Success!</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Row>
              <AiOutlineCheckCircle color="#0d6efd" size={100} />
              <Card.Subtitle className="mt-4 text-center">
                The Transaction Was Successfull!
              </Card.Subtitle>
            </Row>
          </Offcanvas.Body>
        </Offcanvas>
      </div>
    </>
  );
};

export default PaymentFeedback;
