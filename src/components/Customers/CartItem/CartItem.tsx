import { useState } from "react";
import { Badge, Card, Button, Image, Form } from "react-bootstrap";
import { useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  deleteFromCart,
  selectCartsData,
  selectPendingSplit,
  selectSplitErrors,
  setSplitQty,
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
  const menuId = menuIdOf(cartItem);
  const splitItem = cart.split.find(
    (s) =>
      s.splitStatus === "open" &&
      s.userId === myUser._id &&
      menuIdOf(s) === menuId
  );
  // What I've asked for wins over what the BE holds until the two agree
  // (setSplitQty), so −/+ answer on the tap rather than after a round trip.
  const pending = useAppSelector(selectPendingSplit);
  const splitError = useAppSelector(selectSplitErrors)[menuId ?? ""];
  const wanted = menuId ? pending[menuId] : undefined;
  const qty = wanted ?? splitItem?.qty ?? 0;
  // How much of this (shared) item is still up for grabs: total minus paid
  // minus whatever OTHER diners at the table already hold in an open split.
  // It caps + so a tap can never ask for more than exists.
  const avail = availableQty(cartItem, cart.split, myUser._id);
  const remaining = avail - qty;
  const selected = qty > 0;
  const fullyClaimed = avail <= 0 && !selected;

  // Sold out after it was added: it stays listed until someone removes it, but
  // can't be (newly) selected or paid for. A selection made before it sold out
  // can still be cleared, so the checkbox only locks once it is unticked.
  const soldOut = isSoldOut(cartItem);
  const paidQty = cartItem?.qtyPayed ?? 0;

  const dispatch = useAppDispatch();

  const want = (next: number) => {
    if (!menuId) return;
    dispatch(
      setSplitQty({
        shopId,
        tableId,
        cartId,
        menuId,
        qty: Math.max(0, Math.min(next, avail)),
      })
    );
  };

  const handleSelect = () => want(selected ? 0 : 1);
  const increment = () => {
    if (remaining > 0) want(qty + 1);
  };
  const decrement = () => want(qty - 1);

  // The bin removes the item for the whole table, so a double tap mustn't
  // send it twice.
  const [deleting, setDeleting] = useState(false);
  const deleteItemFromCart = () => {
    if (!cartItem?.menuId || deleting) return;
    setDeleting(true);
    dispatch(
      deleteFromCart({
        shopId: shopId,
        tableId: tableId,
        item: cartItem,
      })
    ).finally(() => setDeleting(false));
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
          {/* Why a change was undone (the count has already snapped back).
              Always mounted: a live region inserted with its text is often
              not announced. */}
          <small className="split-error d-block text-danger" role="status">
            {splitError}
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
              <div
                className="stepper"
                role="group"
                aria-label={`Quantity of ${name} to pay`}
              >
                <Button
                  variant="link"
                  className="hit-44"
                  onClick={decrement}
                  aria-label="Decrease quantity"
                >
                  −
                </Button>
                <span className="qty">{qty}</span>
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
                disabled={deleting}
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
