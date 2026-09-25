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
            <Row className="pb-2 align-items-center">
              <Col xs={5}>
                <Card.Body className="p-0 ms-3">
                  <span className="price text-primary">
                    £ {menuItem?.price}
                  </span>
                </Card.Body>
              </Col>
              <Col xs={5}>
                {tableId && !soldOut && (
                  <Row className="quantity-wrapper text-center align-items-center">
                    <Col className="px-0">
                      <Button className="" size="sm" onClick={decrement}>
                        <strong>-</strong>
                      </Button>
                    </Col>
                    <Col className="px-0">
                      <Card.Body className="p-0">
                        <small>{item.qty}</small>
                      </Card.Body>
                    </Col>
                    <Col className="px-0">
                      <Button className="" size="sm" onClick={increment}>
                        <strong>+</strong>
                      </Button>
                    </Col>
                  </Row>
                )}
              </Col>
              <Col xs={2}></Col>
            </Row>
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
            {/* In the Add button's place, so it replaces the action the
                customer would reach for. Shown with or without a table. Light
                with dark text: a mid-grey pill is hard to tell from the teal
                buttons for red-blind customers, so it differs by brightness. */}
            {soldOut && (
              <Badge bg="light" text="dark" className="sold-out-badge border">
                Sold out
              </Badge>
            )}
            {tableId && !soldOut && (
              <Button
                className="add-button"
                // variant="outline-primary"
                size="sm"
                onClick={addItemToCart}
                disabled={item.qty < 1}
              >
                <strong>Add</strong>
              </Button>
            )}
          </Col>
        </Row>
      </Card>
    </>
  );
};

export default MenuItem;
