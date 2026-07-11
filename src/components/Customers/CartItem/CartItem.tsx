import { Card, Col, Row, Button, Image, Form } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  addToSplit,
  decreaseSplit,
  deleteFromCart,
  removeFromSplit,
  selectCartsData,
} from "../../../redux/slices/cartSlice";
import { selectUserData } from "../../../redux/slices/userSlice";
import { menuIdOf } from "../../../lib/cart";
import { RiDeleteBinLine } from "react-icons/ri";
import "./CartItem.css";

interface CartItemProps {
  cartId: string;
  itemId: string | undefined;
}

const CartItem = ({ cartId, itemId }: CartItemProps) => {
  const { shopId = "", tableId = "" } = useParams<{
    shopId: string;
    tableId: string;
  }>();

  const cart = useAppSelector(selectCartsData);
  const myUser = useAppSelector(selectUserData);
  const cartItem = cart.items.find((item) => item._id === itemId);
  const splitItem = cart.split.find(
    (s) =>
      s.splitStatus === "open" &&
      s.userId === myUser._id &&
      menuIdOf(s) === menuIdOf(cartItem)
  );
  const payed = cartItem?.qtyPayed ?? 0;
  const itemQty = (cartItem?.qty ?? 0) - payed;

  const selected = !!splitItem;

  const dispatch = useAppDispatch();

  const handleSelect = () => {
    if (splitItem) {
      removeItemFromSplit();
    } else {
      increment();
    }
  };

  const increment = () => {
    //<====================   adds one unit of the item to the SPLIT
    if (!cartItem?.menuId) return;

    const plusItem = {
      ...cartItem,
      qty: 1,
    };

    dispatch(
      addToSplit({
        shopId: shopId,
        tableId: tableId,
        cartId: cartId,
        item: plusItem,
      })
    );
  };

  const decrement = () => {
    if (!cartItem?.menuId) return;

    dispatch(
      decreaseSplit({
        shopId: shopId,
        tableId: tableId,
        cartId: cartId,
        item: cartItem,
      })
    );
  };

  const removeItemFromSplit = () => {
    if (!cartItem?.menuId) return;
    dispatch(
      removeFromSplit({
        shopId: shopId,
        tableId: tableId,
        cartId: cartId,
        item: cartItem,
      })
    );
  };

  const deleteItemFromCart = () => {
    if (!cartItem?.menuId) return;
    dispatch(
      deleteFromCart({
        shopId: shopId,
        tableId: tableId,
        item: cartItem,
      })
    );
  };

  if (!cartItem) return null;

  return (
    <>
      <Row className="align-items-center">
        <Col className="d-flex p-0" xs={1}>
          <Form.Group
            className="ms-3 text-center"
            controlId="formBasicCheckbox"
          >
            <Form.Check
              type="checkbox"
              checked={selected}
              onChange={handleSelect}
            />
          </Form.Group>
        </Col>
        <Col xs={11}>
          <Card className="CartItem">
            <Row>
              <Col className="image-col pe-0 " xs={4}>
                <Image
                  src={cartItem?.menuId?.image}
                  rounded
                  fluid
                  className="w-100 h-100"
                />
              </Col>
              <Col xs={8} className="text-start ps-2">
                <Row className="my-3">
                  <Col>
                    <Card.Subtitle className="ms-3">
                      {cartItem?.menuId?.name}
                    </Card.Subtitle>
                  </Col>
                  <Col xs="auto">
                    <span className="cart-qty-span">
                      <small>
                        in cart:{" "}
                        {splitItem?.qty ? itemQty - splitItem.qty : itemQty}
                      </small>
                    </span>
                  </Col>
                </Row>
                <Row className="pb-1 align-items-center">
                  <Col className="p-0" xs={4}>
                    <Card.Body className="p-0 ms-3">
                      <span className="price text-primary">
                        £ {cartItem?.menuId?.price}
                      </span>
                    </Card.Body>
                  </Col>
                  <Col xs={6}>
                    <Row className="quantity-wrapper text-center align-items-center">
                      <Col className="px-0">
                        {selected ? (
                          <Button active size="sm" onClick={decrement}>
                            <strong>-</strong>
                          </Button>
                        ) : (
                          <></>
                        )}
                      </Col>
                      <Col className="px-0">
                        <Card.Body className="p-0">
                          <small>{splitItem?.qty}</small>
                        </Card.Body>
                      </Col>
                      <Col className="px-0">
                        {selected ? (
                          (splitItem?.qty
                            ? itemQty - splitItem.qty
                            : itemQty) <= 0 ? (
                            <Button disabled size="sm" onClick={increment}>
                              <strong>+</strong>
                            </Button>
                          ) : (
                            <Button active size="sm" onClick={increment}>
                              <strong>+</strong>
                            </Button>
                          )
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={deleteItemFromCart}
                          >
                            <RiDeleteBinLine />
                          </Button>
                        )}
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default CartItem;
