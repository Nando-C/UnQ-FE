import { useEffect, useState } from "react";
import { Card, Col, Container, Image, Row, Button } from "react-bootstrap";
import { IoArrowBack } from "react-icons/io5";
import { useHistory } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  getTableCart,
  selectCartPointers,
  selectCartsData,
} from "../../../redux/slices/cartSlice";
import { selectSelectedShop } from "../../../redux/slices/shopSlice";
import CartListItems from "../CartListItems/CartListItems";
import "./Cart.css";

const Cart = () => {
  const dispatch = useAppDispatch();
  const { shopId, tableId } = useAppSelector(selectCartPointers);
  console.log("shopId: ", shopId);
  console.log("tableId: ", tableId);

  const [tableName, setTableName] = useState("");

  const shop = useAppSelector(selectSelectedShop);

  useEffect(() => {
    // dispatch(getMyOpenCart())
    dispatch(getTableCart(tableId));
    if (tableId) {
      const tName = shop!.tables.filter((table) => table._id === tableId)[0]
        .name;
      setTableName(tName);
      console.log(tName);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cart = useAppSelector(selectCartsData);
  // console.log(cart)

  const history = useHistory();
  const goBack = () => {
    history.goBack();
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
              <Row className="align-items-center">
                <Col className="image-col pe-0 ">
                  <Image
                    src="https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png"
                    rounded
                    fluid
                  />
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
