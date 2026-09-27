import { useEffect, useRef, useState } from "react";
import { Badge, Card, Col, Image, Row, Button } from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { addToCart } from "../../../redux/slices/cartSlice";
import {
  fetchSingleShop,
  selectSelectedShop,
} from "../../../redux/slices/shopSlice";
import { selectUserData } from "../../../redux/slices/userSlice";
import { IItem } from "../../../typings/cart";
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

  const addItemToCart = async () => {
    if (user._id) {
      clearAddError();
      try {
        await dispatch(
          addToCart({
            shopId: shopId,
            tableId: tableId,
            item: item,
          })
        ).unwrap();
      } catch (err) {
        const rejection = err as { status?: number } | undefined;
        if (rejection?.status === 409) {
          showAddError(`Sorry — ${menuItem?.name} just sold out.`);
          // Pull the fresh menu so this card turns into its sold-out state.
          dispatch(fetchSingleShop(shopId));
        } else {
          showAddError("Couldn't add this to your cart — please try again.");
        }
      }
    } else {
      navigate("/login");
    }
  };

  return (
    <>
      <Card
        className={soldOut ? "MenuItem sold-out" : "MenuItem"}
        aria-disabled={soldOut || undefined}
      >
        <Row>
          <Col
            xs={8}
            className="text-start d-flex flex-column justify-content-between pe-2"
          >
            <Row className="mt-2">
              <Col>
                <Card.Subtitle className="ms-3">{menuItem?.name}</Card.Subtitle>
                <Card.Body className="ms-3 p-0">
                  <small>
                    <span>{menuItem?.short_description}</span>
                  </small>
                </Card.Body>
              </Col>
            </Row>
            {/* Price, quantity and Add in one row, so ordering is one tap
                and doesn't depend on hover (phones only emulate it on tap).
                Wraps under the price when the card is too narrow. */}
            <div className="actions d-flex flex-wrap align-items-center column-gap-3 row-gap-2 ms-3 pb-2">
              <span className="price text-primary">£ {menuItem?.price}</span>
              {tableId && !soldOut && (
                <div className="d-flex flex-wrap align-items-center column-gap-3 row-gap-2">
                  {/* One outlined control, as tall as Add, so the filled Add
                      reads as the action and the stepper as its setting. */}
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
                    disabled={item.qty < 1}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
            {/* Always mounted (a live region inserted along with its text is
                often not announced); empty and zero-height otherwise. */}
            <div className="add-error ms-3" role="status" aria-live="polite">
              {addError && (
                <small className="text-danger d-block pb-2">{addError}</small>
              )}
            </div>
          </Col>
          <Col className="image-col ps-0" xs={4}>
            <Image
              src={menuItem?.image}
              rounded
              fluid
              className="w-100 h-100"
            />
            <div className="image-overlayer"></div>
            {/* On the photo, where it can't be missed. Shown with or without a
                table. Light with dark text: a mid-grey pill is hard to tell
                from the teal buttons for red-blind customers, so it differs
                by brightness. */}
            {soldOut && (
              <Badge bg="light" text="dark" className="sold-out-badge border">
                Sold out
              </Badge>
            )}
          </Col>
        </Row>
      </Card>
    </>
  );
};

export default MenuItem;
