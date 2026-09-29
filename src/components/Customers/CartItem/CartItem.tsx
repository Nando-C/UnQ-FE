import { useState } from "react";
import { Badge, Card, Button, Image, Form } from "react-bootstrap";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  deleteFromCart,
  getTableCart,
  removeFromCart,
  selectCartsData,
  selectPendingSplit,
  selectSplitErrors,
  setSplitQty,
  type CartRejection,
} from "../../../redux/slices/cartSlice";
import { selectUserData } from "../../../redux/slices/userSlice";
import { availableQty, isSoldOut, menuIdOf, myOpenSplit, unpaidQty } from "../../../lib/cart";
import { RiDeleteBinLine } from "react-icons/ri";
import { formatPrice } from "../../../lib/price";
import { rememberReturnTo } from "../../../lib/returnTo";
import { useFlash } from "../../../lib/useFlash";
import placeholder from "../../../assets/placeholder.svg";
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
  const splitItem = myOpenSplit(cart.split, myUser._id, menuId);
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

  // The cart is public, but changing it needs an account: a guest is sent to
  // sign in (and back here after), as the menu's Add does.
  const navigate = useNavigate();
  const location = useLocation();
  const signedIn = !!myUser._id;
  const signInFirst = () => {
    rememberReturnTo(location.pathname);
    navigate("/login");
  };

  // Why the bin or − didn't do (all of) what was asked. Cleared after a few
  // seconds, like the menu's Add errors.
  const [rowError, showRowError] = useFlash<string>(5000);

  const want = (next: number) => {
    if (!menuId) return;
    if (!signedIn) return signInFirst();
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

  // The bin removes the item for the whole table, except the units other
  // diners have selected to pay for; − orders one less, never below those. One
  // request at a time, so a double tap can't send it twice.
  const [changing, setChanging] = useState(false);
  const changeOrder = async (change: "bin" | "oneLess") => {
    if (!signedIn) return signInFirst();
    if (!cartItem?.menuId || changing) return;
    showRowError(null);
    setChanging(true);
    try {
      if (change === "bin") {
        // Nothing back (204) when that emptied the cart and it went.
        const cart = await dispatch(deleteFromCart({ shopId, tableId, item: cartItem })).unwrap();
        const held = unpaidQty(cart ? cart.items.find((i) => menuIdOf(i) === menuId) : undefined);
        if (held > 0) showRowError(`${held} kept: someone at the table is paying for them.`);
      } else {
        await dispatch(removeFromCart({ shopId, tableId, item: { ...cartItem, qty: 1 } })).unwrap();
      }
    } catch (err) {
      const reason = (err as CartRejection | undefined)?.message;
      showRowError(
        reason === "Those units are already paid for or selected for payment" ||
          reason === "Someone at the table is paying for those"
          ? "Someone at the table is paying for those."
          : reason || "Couldn't change the order, please try again."
      );
      // It has probably changed under us: show it as it is now.
      dispatch(getTableCart(tableId));
    } finally {
      setChanging(false);
    }
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
        {/* A menu item deleted since it was added comes back from the BE with
            no image (a sold-out stand-in), so fall back to the placeholder. */}
        <Image className="cart-thumb" src={cartItem.menuId?.image || placeholder} alt="" rounded />
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
            {rowError ?? splitError}
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
              <div className="order-actions d-flex align-items-center gap-2">
                {/* One less of a line with more than one unpaid unit; for the
                    last one it would do what the bin does. */}
                {!soldOut && cartItem.qty - paidQty > 1 && (
                  <Button
                    variant="outline-secondary"
                    className="hit-44"
                    onClick={() => changeOrder("oneLess")}
                    disabled={changing}
                    aria-label={`Order one less ${name}`}
                  >
                    −
                  </Button>
                )}
                <Button
                  className="hit-44"
                  variant="danger"
                  onClick={() => changeOrder("bin")}
                  disabled={changing}
                  aria-label={`Remove ${name} from the cart`}
                >
                  <RiDeleteBinLine />
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CartItem;
