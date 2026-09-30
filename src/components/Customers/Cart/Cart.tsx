import { useEffect, useState } from "react";
import { Card, Col, Container, Image, Row, Button } from "react-bootstrap";
import { IoArrowBack } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  getTableCart,
  selectCartLoaded,
  selectCartsData,
  storeCartPointers,
} from "../../../redux/slices/cartSlice";
import {
  fetchSingleShop,
  selectSelectedFailed,
  selectSelectedShop,
} from "../../../redux/slices/shopSlice";
import CartListItems from "../CartListItems/CartListItems";
import PaymentFeedback, { FeedbackVariant } from "../PaymentFeedback/PaymentFeedback";
import CartNotices from "../CartNotices/CartNotices";
import CartItemPlaceholder from "../CartItem/CartItemPlaceholder";
import { Loading, LoadFailed } from "../../Common/ScreenStates";
import wordmark from "../../../assets/unq-wordmark-onematerial.svg";
import "./Cart.css";
import { tablePath } from "../../../lib/paths";

const Cart = () => {
  const dispatch = useAppDispatch();
  const { shopId = "", tableId = "" } = useParams<{
    shopId: string;
    tableId: string;
  }>();

  // The store may hold another shop (opened before); only this one names the
  // table. Once it has loaded, a table it doesn't list shows no name.
  const selected = useAppSelector(selectSelectedShop);
  const shop = selected?._id === shopId ? selected : null;
  const shopFailed = useAppSelector(selectSelectedFailed) === shopId;
  const tableName =
    shop?.tables.find((table) => table._id === tableId)?.name ?? "";

  useEffect(() => {
    if (tableId) {
      dispatch(getTableCart(tableId));
    }
  }, [dispatch, tableId]);

  // The bottom bar only links to (and highlights) the cart once it knows the
  // table. TableMenu records it, but a cart page opened directly or refreshed
  // never passes through the menu, so it's recorded here too.
  useEffect(() => {
    dispatch(storeCartPointers({ shopId, tableId }));
  }, [dispatch, shopId, tableId]);

  // Keyed on whether this shop is in hand, not on the object, so a refetch
  // of it elsewhere doesn't start another here.
  const haveShop = !!shop;
  useEffect(() => {
    if (shopId && !haveShop) {
      dispatch(fetchSingleShop(shopId));
    }
  }, [dispatch, shopId, haveShop]);

  const cart = useAppSelector(selectCartsData);
  // Until the BE has answered for this table, an empty cart only means "not
  // loaded yet", so the page shows placeholders rather than "no orders".
  const loaded = useAppSelector(selectCartLoaded);
  const answered = loaded?.tableId === tableId;

  const navigate = useNavigate();
  // The cart is only reached from its table's menu, so Back goes there by
  // path: back a page could land on the sign-in form a diner passed through.
  const goBack = () => {
    navigate(tablePath(shopId, tableId));
  };

  // How a checkout ended, and whether that sheet is open. Kept apart so a
  // closing sheet keeps its content while it slides away. Every outcome stays
  // until the diner closes it: a success is a money confirmation, and a failure
  // may say not to pay again or carry the order id staff need. Closing a
  // success goes on to the table's menu.
  const [fbk, setFbk] = useState<{ variant: FeedbackVariant; message?: string } | null>(null);
  const [fbkOpen, setFbkOpen] = useState(false);
  const handleShowFbk = (variant: FeedbackVariant, message?: string) => {
    setFbk({ variant, message });
    setFbkOpen(true);
  };
  const handleCloseFbk = () => {
    // By path, not back a page: see goBack.
    if (fbk?.variant === "success") goBack();
    setFbkOpen(false);
  };

  return (
    <>
      <Container className="Cart phone-column bg-light">
        <Row className="align-items-center pt-3">
          <Col xs={2}>
            <Button variant="link" className="hit-44" onClick={goBack} aria-label="Back">
              <IoArrowBack size={25} />
            </Button>
          </Col>
          {tableId && (
            <Col className="text-center" xs={8}>
              <Card.Subtitle className="cart-table-name">
                {tableName ? (
                  <span>Table: {tableName}</span>
                ) : !shop && !shopFailed ? (
                  <span className="placeholder-glow" aria-hidden="true">
                    <span className="placeholder col-6" />
                  </span>
                ) : null}
              </Card.Subtitle>
            </Col>
          )}
        </Row>
        {cart.items.length > 0 ? (
          <CartListItems handleShowFbk={handleShowFbk} />
        ) : !answered ? (
          <Loading label="Loading the table's cart">
            <div className="d-grid gap-2 pt-5">
              <CartItemPlaceholder />
              <CartItemPlaceholder />
            </div>
          </Loading>
        ) : loaded.failed ? (
          <LoadFailed
            message="Couldn't load this table's cart."
            onRetry={() => dispatch(getTableCart(tableId))}
          />
        ) : (
          <>
            {/* Why the cart is empty, when staff did it ("The staff closed
                this table"): the list, which shows them otherwise, isn't here. */}
            <CartNotices notices={cart.notices} />
            <Card className="text-center">
              <Card.Body className="py-4">
                <Image src={wordmark} alt="" fluid className="mb-4" style={{ maxWidth: "10rem" }} />
                <Card.Title>No open orders</Card.Title>
                <Card.Text className="text-body-secondary">
                  Anything added from the menu shows up here.
                </Card.Text>
                <Button onClick={goBack}>Back to the menu</Button>
              </Card.Body>
            </Card>
          </>
        )}
      </Container>
      <PaymentFeedback
        showFbk={fbkOpen}
        variant={fbk?.variant ?? "success"}
        message={fbk?.message}
        handleCloseFbk={handleCloseFbk}
      />
    </>
  );
};

export default Cart;
