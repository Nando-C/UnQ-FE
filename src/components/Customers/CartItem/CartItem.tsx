import { Badge, Card, Col, Row, Button, Image, Form } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  addToSplit,
  decreaseSplit,
  deleteFromCart,
  getTableCart,
  removeFromSplit,
  selectCartsData,
} from "../../../redux/slices/cartSlice";
import { selectUserData } from "../../../redux/slices/userSlice";
import { availableQty, isSoldOut, menuIdOf } from "../../../lib/cart";
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
  // How much of this (shared) item is still up for grabs: total minus paid
  // minus whatever OTHER diners at the table already hold in an open split.
  const avail = availableQty(cartItem, cart.split, myUser._id);
  const remaining = splitItem?.qty ? avail - splitItem.qty : avail;
  const fullyClaimed = avail <= 0 && !splitItem;

  const selected = !!splitItem;
  // Sold out after it was added: it stays listed until someone removes it, but
  // can't be (newly) selected or paid for. A selection made before it sold out
  // can still be cleared, so the checkbox only locks once it is unticked.
  const soldOut = isSoldOut(cartItem);
  const paidQty = cartItem?.qtyPayed ?? 0;

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
    )
      .unwrap()
      .catch(() => {
        // A 409 means someone else claimed the unit first — the refreshed
        // cart is the feedback, no toast needed.
        dispatch(getTableCart(tableId));
      });
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
    )
      .unwrap()
      .catch(() => {
        dispatch(getTableCart(tableId));
      });
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
              disabled={fullyClaimed || (soldOut && !selected)}
              onChange={handleSelect}
              aria-label={`Select ${cartItem.menuId?.name ?? "item"} to pay`}
            />
            {fullyClaimed && !soldOut && (
              <Form.Text muted className="d-block">
                claimed by others
              </Form.Text>
            )}
          </Form.Group>
        </Col>
        <Col xs={11}>
          <Card className={soldOut ? "CartItem sold-out" : "CartItem"}>
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
                      {soldOut && (
                        <Badge bg="secondary" className="ms-2 align-middle">
                          Sold out
                        </Badge>
                      )}
                    </Card.Subtitle>
                    {soldOut && (
                      <small className="sold-out-note d-block ms-3 mt-1">
                        No longer available — you won't be charged for it.
                        {paidQty > 0 && ` ${paidQty} already paid.`}
                      </small>
                    )}
                  </Col>
                  <Col xs="auto">
                    <span className="cart-qty-span">
                      <small>in cart: {remaining}</small>
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
                        {selected && !soldOut ? (
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
                        {/* Removing is the way forward for a sold-out row, so
                            its bin shows even while it's selected; + would
                            only be refused by the BE. */}
                        {selected && !soldOut ? (
                          remaining <= 0 ? (
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
                            aria-label={`Remove ${cartItem.menuId?.name ?? "item"} from the cart`}
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
