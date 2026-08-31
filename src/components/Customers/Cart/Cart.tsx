import { useEffect } from "react";
import { Card, Col, Container, Image, Row, Button } from "react-bootstrap";
import { IoArrowBack } from "react-icons/io5";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { getTableCart, selectCartsData } from "../../../redux/slices/cartSlice";
import {
  fetchSingleShop,
  selectSelectedShop,
} from "../../../redux/slices/shopSlice";
import CartListItems from "../CartListItems/CartListItems";
import wordmark from "../../../assets/unq-wordmark-onematerial.svg";
import "./Cart.css";

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

  useEffect(() => {
    if (shopId && !shop) {
      dispatch(fetchSingleShop(shopId));
    }
  }, [dispatch, shopId, shop]);

  const cart = useAppSelector(selectCartsData);

  const navigate = useNavigate();
  const goBack = () => {
    navigate(-1);
  };

  return (
    <>
      <Container className="Cart bg-light">
        <Row className="align-items-center pt-3">
          <Col xs={2}>
            <Button onClick={goBack}>
              <IoArrowBack size={25} />
            </Button>
            {/* <span>Back</span> */}
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
        )}
      </Container>
    </>
  );
};

export default Cart;
