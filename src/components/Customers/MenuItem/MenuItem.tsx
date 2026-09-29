import { useEffect, useRef, useState } from "react";
import { Badge, Card, Image, Button } from "react-bootstrap";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { addToCart } from "../../../redux/slices/cartSlice";
import {
  fetchSingleShop,
  selectSelectedShop,
} from "../../../redux/slices/shopSlice";
import { selectUserData } from "../../../redux/slices/userSlice";
import { IItem } from "../../../typings/cart";
import { formatPrice } from "../../../lib/price";
import { rememberReturnTo } from "../../../lib/returnTo";
import "./MenuItem.css";

interface MenuItemProps {
  itemId: string;
  shopId: string;
}

const MenuItem = ({ shopId, itemId }: MenuItemProps) => {
  const { tableId = "" } = useParams<{ tableId: string }>();

  const [item, setItem] = useState<IItem>({
    menuId: null,
    qty: 1,
  });

  // The shop (and so this card's data) is fetched once by TableMenu; every
  // card used to refetch the whole shop on mount as well.
  const dispatch = useAppDispatch();

  const shop = useAppSelector(selectSelectedShop);
  const menuItem = shop?.menu.find((item) => item._id === itemId);

  useEffect(() => {
    setItem((prev) => ({ ...prev, menuId: menuItem }));
  }, [menuItem]);

  const soldOut = menuItem?.available === false;

  // Why an "Add" didn't go through. Before this a failed add was silently
  // ignored, so a customer whose page predated the item selling out just saw
  // nothing happen. Cleared on the next interaction or after a few seconds.
  const [addError, setAddError] = useState<string | null>(null);
  const addErrorTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clearAddError = () => {
    if (addErrorTimeoutRef.current) clearTimeout(addErrorTimeoutRef.current);
    setAddError(null);
  };
  const showAddError = (message: string) => {
    clearAddError();
    setAddError(message);
    addErrorTimeoutRef.current = setTimeout(() => setAddError(null), 5000);
  };
  useEffect(() => () => clearTimeout(addErrorTimeoutRef.current), []);

  const increment = () => {
    clearAddError();
    const newQty = item.qty + 1;
    setItem({ ...item, qty: newQty });
  };

  const decrement = () => {
    clearAddError();
    const newQty = item.qty - 1;
    if (newQty >= 0) {
      setItem({ ...item, qty: newQty });
    } else {
      setItem({ ...item, qty: 0 });
    }
  };

  const user = useAppSelector(selectUserData);
  const navigate = useNavigate();
  const location = useLocation();

  // Add is off while it's sending, so a second tap can't order it twice, and
  // says "Added" for a moment once it's in: the only other sign was the badge
  // in the bottom bar.
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const addedTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(addedTimeoutRef.current), []);

  const addItemToCart = async () => {
    if (adding) return;
    if (user._id) {
      clearAddError();
      setAdding(true);
      try {
        await dispatch(
          addToCart({
            shopId: shopId,
            tableId: tableId,
            item: item,
          })
        ).unwrap();
        clearTimeout(addedTimeoutRef.current);
        setAdded(true);
        addedTimeoutRef.current = setTimeout(() => setAdded(false), 2000);
      } catch (err) {
        const rejection = err as { status?: number; message?: string } | undefined;
        if (rejection?.status === 409 && rejection.message !== "This item is sold out") {
          // The BE's other 409: several diners changed the cart at once.
          showAddError("Someone else just changed the cart — please try again.");
        } else if (rejection?.status === 409) {
          showAddError(`Sorry — ${menuItem?.name} just sold out.`);
          // Pull the fresh menu so this card turns into its sold-out state.
          dispatch(fetchSingleShop(shopId));
        } else if (rejection?.message === "Table Not Found!") {
          showAddError("This table isn't taking orders any more — please ask staff.");
        } else {
          showAddError("Couldn't add this to your cart — please try again.");
        }
      } finally {
        setAdding(false);
      }
    } else {
      rememberReturnTo(location.pathname);
      navigate("/login");
    }
  };

  return (
    <Card
      className={soldOut ? "MenuItem sold-out" : "MenuItem"}
      aria-disabled={soldOut || undefined}
    >
      {/* Text beside a fixed square photo; the text column takes what's left
          and long names wrap inside it instead of pushing the photo. */}
      <div className="menu-media">
        <div className="menu-text">
          <Card.Subtitle>{menuItem?.name}</Card.Subtitle>
          {menuItem?.short_description && (
            <small className="menu-desc d-block">
              {menuItem.short_description}
            </small>
          )}
        </div>
        <div className="menu-photo">
          <Image src={menuItem?.image} alt="" rounded />
          {/* On the photo, where it can't be missed. Shown with or without a
              table. Light with dark text: a mid-grey pill is hard to tell
              from the teal buttons for red-blind customers, so it differs
              by brightness. */}
          {soldOut && (
            <Badge bg="light" text="dark" className="sold-out-badge border">
              Sold out
            </Badge>
          )}
        </div>
      </div>
      {/* Price, quantity and Add across the full card, so ordering is one tap
          and doesn't depend on hover (phones only emulate it on tap). The
          stepper and Add wrap under the price together when there's no room,
          and Add under the stepper at very large text sizes. */}
      <div className="actions">
        <span className="price text-primary text-nowrap">
          {formatPrice(menuItem?.price)}
        </span>
        {tableId && !soldOut && (
          <div className="order d-flex flex-wrap align-items-center column-gap-3 row-gap-2">
            {/* One outlined control, as tall as Add, so the filled Add reads
                as the action and the stepper as its setting. */}
            <div className="stepper" role="group" aria-label="Quantity">
              <Button
                variant="link"
                className="hit-44"
                onClick={decrement}
                aria-label="Decrease quantity"
              >
                −
              </Button>
              <span className="qty">{item.qty}</span>
              <Button
                variant="link"
                className="hit-44"
                onClick={increment}
                aria-label="Increase quantity"
              >
                +
              </Button>
            </div>
            <Button
              className="add-button"
              onClick={addItemToCart}
              disabled={item.qty < 1 || adding}
            >
              {added ? "Added" : "Add"}
            </Button>
          </div>
        )}
      </div>
      {/* Always mounted (a live region inserted along with its text is often
          not announced); empty and zero-height otherwise. */}
      <div className="add-error" role="status" aria-live="polite">
        {addError && (
          <small className="text-danger d-block pt-2">{addError}</small>
        )}
      </div>
    </Card>
  );
};

export default MenuItem;
