import { useEffect, useState } from "react";
import { Card, ListGroup, Row, Button, Form, Col } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { useHistory, useParams } from "react-router";
import { useAppSelector } from "../../../redux/app/hooks";
import { getTableCart, selectCartsData } from "../../../redux/slices/cartSlice";
import CartItem from "../CartItem/CartItem";
import CheckOut from "../CheckOut/CheckOut";
import PaymentFeedback from "../PaymentFeedback/PaymentFeedback";
import "./CartListItems.css";

const CartListItems = () => {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(getTableCart(tableId));
  }, []);

  const cart = useAppSelector(selectCartsData);
  const [selectedAll, setSelectedAll] = useState(false);

  const totalCart = cart.items.reduce(
    (total, item) => total + item.qty * item.menuId.price,
    0
  );
  const totalSplit = cart.split
    .filter((split) => split.splitStatus === "open")
    .reduce((total, split) => total + split.qty * split.menuId.price, 0);

  const totalSplitPayed = cart.split
    .filter((split) => split.splitStatus === "closed")
    .reduce((total, split) => total + split.qty * split.menuId.price, 0);

  const remainingCartTotal = totalCart - totalSplitPayed - totalSplit;

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const history = useHistory();

  const [showFbk, setShowFbk] = useState(false);
  const handleShowFbk = () => {
    setShowFbk(true);
    const timer = setTimeout(() => {
      handleCloseFbk();
    }, 3000);
    return () => clearTimeout(timer);
  };
  const handleCloseFbk = () => {
    history.goBack();
    setShowFbk(false);
  };

  return (
    <>
      <Row className="justify-content-between align-items-center">
        <Col xs={4}>
          <Form.Group
            className="ms-2 text-center"
            controlId="formBasicCheckbox"
          >
            <Form.Check
              type="checkbox"
              checked={selectedAll}
              onChange={() => setSelectedAll(!selectedAll)}
              label="Select All"
            />
          </Form.Group>
        </Col>
        <Col xs={8}>
          <Row className="text-end">
            {remainingCartTotal !== totalCart ? (
              <Card.Body className="pb-1">
                Remaining Cart Total <strong> £ {remainingCartTotal}</strong>
              </Card.Body>
            ) : (
              <Card.Body className="pb-1">
                Cart Total <strong> £ {totalCart}</strong>
              </Card.Body>
            )}
            {/* <Card.Body>
                    Cart Total <strong> £ {totalCart}</strong>
                </Card.Body> */}
            <Card.Body className="pt-1">
              Total Payed <strong> £ {totalSplitPayed}</strong>
            </Card.Body>
          </Row>
        </Col>
      </Row>
      <ListGroup className="px-0" variant="flush">
        {cart.items
          .filter((i) => i.qtyPayed! < i.qty)
          .map((item) => (
            <ListGroup.Item key={item._id} className="px-0 menu-item">
              <CartItem
                selectedAll={selectedAll}
                cartId={cart._id}
                itemId={item._id}
                setSelectedAll={setSelectedAll}
              />
            </ListGroup.Item>
          ))}
      </ListGroup>

      <Row className="mx-1 py-5">
        <Button onClick={handleShow} className="mb-3">
          CheckOut <strong>£{totalSplit}</strong>{" "}
        </Button>
      </Row>
      <CheckOut
        show={show}
        handleClose={handleClose}
        total={totalSplit}
        handleShowFbk={handleShowFbk}
      />
      <PaymentFeedback showFbk={showFbk} handleCloseFbk={handleCloseFbk} />
    </>
  );
};

export default CartListItems;
