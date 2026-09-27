import { Badge, Card, Button, Image, Form } from "react-bootstrap";
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
import { formatPrice } from "../../../lib/price";
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

  const name = cartItem.menuId?.name ?? "item";

  return (
    <div className="CartRow">
      {/* A 44px cell; the label around the box gives it a 44px tap area. */}
      <div className="cart-check">
        <label className="check-label hit-44">
          <Form.Check.Input
            type="checkbox"
            checked={selected}
            disabled={fullyClaimed || (soldOut && !selected)}
            onChange={handleSelect}
            aria-label={`Select ${name} to pay`}
          />
        </label>
      </div>
      <Card className={soldOut ? "CartItem sold-out" : "CartItem"}>
        <Image className="cart-thumb" src={cartItem.menuId?.image} alt="" rounded />
        <div className="cart-body">
          <Card.Subtitle>
            {cartItem.menuId?.name}
            {soldOut && (
              <Badge bg="light" text="dark" className="ms-2 align-middle border">
                Sold out
              </Badge>
            )}
          </Card.Subtitle>
          <small className="cart-meta d-block">
            in cart: {remaining}
            {fullyClaimed && !soldOut && " · claimed by others"}
          </small>
          {soldOut && (
            <small className="sold-out-note d-block">
              No longer available — you won't be charged for it.
              {paidQty > 0 && ` ${paidQty} already paid.`}
            </small>
          )}
          {/* Price left, controls right; the controls drop under the price
              when the row is too narrow for both. */}
          <div className="cart-line">
            <span className="price text-primary text-nowrap">
              {formatPrice(cartItem.menuId?.price)}
            </span>
            {/* Removing is the way forward for a sold-out row, so its bin
                shows even while it's selected; + would only be refused by
                the BE. */}
            {selected && !soldOut ? (
              <div className="stepper" role="group" aria-label={`Quantity of ${name} to pay`}>
                <Button
                  variant="link"
                  className="hit-44"
                  onClick={decrement}
                  aria-label="Decrease quantity"
                >
                  −
                </Button>
                <span className="qty">{splitItem?.qty}</span>
                <Button
                  variant="link"
                  className="hit-44"
                  onClick={increment}
                  disabled={remaining <= 0}
                  aria-label="Increase quantity"
                >
                  +
                </Button>
              </div>
            ) : (
              <Button
                className="hit-44"
                variant="danger"
                onClick={deleteItemFromCart}
                aria-label={`Remove ${name} from the cart`}
              >
                <RiDeleteBinLine />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CartItem;
