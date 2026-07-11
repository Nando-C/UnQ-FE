import { useEffect, useRef, useState } from "react";
import { Card, ListGroup, Row, Button, Form, Col } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  addToSplit,
  getTableCart,
  removeFromSplit,
  selectCartsData,
} from "../../../redux/slices/cartSlice";
import { selectUserData } from "../../../redux/slices/userSlice";
import { IItem } from "../../../typings/cart";
import { menuIdOf } from "../../../lib/cart";
import CartItem from "../CartItem/CartItem";
import CheckOut from "../CheckOut/CheckOut";
import PaymentFeedback from "../PaymentFeedback/PaymentFeedback";
import "./CartListItems.css";

const CartListItems = () => {
  const { shopId = "", tableId = "" } = useParams<{
    shopId: string;
    tableId: string;
  }>();

  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(getTableCart(tableId));
  }, [dispatch, tableId]);

  const cart = useAppSelector(selectCartsData);
  const myUser = useAppSelector(selectUserData);

  const visibleItems = cart.items.filter((i) => (i.qtyPayed ?? 0) < i.qty);
  const mySplitFor = (item: IItem) =>
    cart.split.find(
      (s) =>
        s.splitStatus === "open" &&
        s.userId === myUser._id &&
        menuIdOf(s) === menuIdOf(item)
    );

  // "Select All" is derived, never stored: checked exactly when every unpaid
  // item has an open split of mine. Toggling it dispatches per-item commands,
  // so it can never disagree with the individual checkboxes.
  const allSelected =
    visibleItems.length > 0 && visibleItems.every((i) => !!mySplitFor(i));

  const handleToggleAll = async () => {
    if (allSelected) {
      for (const item of visibleItems) {
        if (mySplitFor(item)) {
          await dispatch(
            removeFromSplit({ shopId, tableId, cartId: cart._id, item })
          );
        }
      }
    } else {
      // Give unselected items their full remaining qty; items someone already
      // split (partially or fully) are left as they are.
      for (const item of visibleItems) {
        if (!mySplitFor(item)) {
          const remaining = item.qty - (item.qtyPayed ?? 0);
          await dispatch(
            addToSplit({
              shopId,
              tableId,
              cartId: cart._id,
              item: { ...item, qty: remaining },
            })
          );
        }
      }
    }
  };

  const totalCart = cart.items.reduce(
    (total, item) => total + item.qty * (item.menuId?.price ?? 0),
    0
  );
  const totalSplit = cart.split
    .filter((split) => split.splitStatus === "open")
    .reduce((total, split) => total + split.qty * (split.menuId?.price ?? 0), 0);

  const totalSplitPayed = cart.split
    .filter((split) => split.splitStatus === "closed")
    .reduce((total, split) => total + split.qty * (split.menuId?.price ?? 0), 0);

  const remainingCartTotal = totalCart - totalSplitPayed - totalSplit;

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const navigate = useNavigate();

  const [showFbk, setShowFbk] = useState<{
    variant: "success" | "failure";
    message?: string;
  } | null>(null);
  const fbkTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const handleShowFbk = (variant: "success" | "failure", message?: string) => {
    if (fbkTimeoutRef.current) clearTimeout(fbkTimeoutRef.current);
    setShowFbk({ variant, message });
    fbkTimeoutRef.current = setTimeout(() => {
      handleCloseFbk(variant);
    }, 3000);
  };
  const handleCloseFbk = (variant?: "success" | "failure") => {
    if (fbkTimeoutRef.current) clearTimeout(fbkTimeoutRef.current);
    if ((variant ?? showFbk?.variant) === "success") {
      navigate(-1);
    }
    setShowFbk(null);
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
              checked={allSelected}
              onChange={handleToggleAll}
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
        {visibleItems.map((item) => (
          <ListGroup.Item key={item._id} className="px-0 menu-item">
            <CartItem cartId={cart._id} itemId={item._id} />
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
      <PaymentFeedback
        showFbk={!!showFbk}
        variant={showFbk?.variant ?? "success"}
        message={showFbk?.message}
        handleCloseFbk={() => handleCloseFbk()}
      />
    </>
  );
};

export default CartListItems;
