import { useEffect } from "react";
import { Card, Col, Container, Image, Row, Button } from "react-bootstrap";
import { IoArrowBack } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  getTableCart,
  selectCartsData,
  storeCartPointers,
} from "../../../redux/slices/cartSlice";
import {
  fetchSingleShop,
  selectSelectedShop,
} from "../../../redux/slices/shopSlice";
import CartListItems from "../CartListItems/CartListItems";
import CartNotices from "../CartNotices/CartNotices";
import wordmark from "../../../assets/unq-wordmark-onematerial.svg";
import "./Cart.css";
import { tablePath } from "../../../lib/paths";

const Cart = () => {
  const dispatch = useAppDispatch();
  const { shopId = "", tableId = "" } = useParams<{
    shopId: string;
    tableId: string;
  }>();

  const shop = useAppSelector(selectSelectedShop);
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

  useEffect(() => {
    if (shopId && !shop) {
      dispatch(fetchSingleShop(shopId));
    }
  }, [dispatch, shopId, shop]);

  const cart = useAppSelector(selectCartsData);

  const navigate = useNavigate();
  // The cart is only reached from its table's menu, so Back goes there by
  // path: back a page could land on the sign-in form a diner passed through.
  const goBack = () => {
    navigate(tablePath(shopId, tableId));
  };

  return (
    <>
      <Container className="Cart phone-column bg-light">
        <Row className="align-items-center pt-3">
          <Col xs={2}>
            <Button className="hit-44" onClick={goBack} aria-label="Back">
              <IoArrowBack size={25} />
            </Button>
          </Col>
          {tableId && (
            <Col className="text-center" xs={8}>
              <Card.Subtitle className="cart-table-name">
                <span>Table: {tableName}</span>
              </Card.Subtitle>
            </Col>
          )}
        </Row>
        {cart.items.length > 0 ? (
          <CartListItems />
        ) : (
          <>
          {/* Why the cart is empty, when staff did it ("The staff closed
              this table"): the list, which shows them otherwise, isn't here. */}
          <CartNotices notices={cart.notices} />
          <Card>
            <Card.Body>
              <Row className="align-items-center text-center">
                <Col className="image-col py-4">
                  <Image src={wordmark} alt="UnQ" fluid style={{ maxWidth: "14rem" }} />
                </Col>
                <Card.Title>
                  Looks like you don't have any open orders!!
                </Card.Title>
              </Row>
            </Card.Body>
          </Card>
          </>
        )}
      </Container>
    </>
  );
};

export default Cart;
