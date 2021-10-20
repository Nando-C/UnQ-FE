import { useEffect, useState } from "react";
import { Card, Col, Image, Row, Button } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { useParams, useHistory } from "react-router-dom";
import { useAppSelector } from "../../../redux/app/hooks";
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
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  const [item, setItem] = useState<IItem>({
    menuId: null,
    qty: 1,
  });

  const dispatch = useDispatch();
  useEffect(() => {
    dispatch(fetchSingleShop(shopId));
  }, []);

  const shop = useAppSelector(selectSelectedShop);
  const menuItem = shop?.menu.find((item) => item._id === itemId);

  useEffect(() => {
    setItem({ ...item, menuId: menuItem });
  }, [menuItem]);

  const increment = () => {
    const newQty = item.qty + 1;
    setItem({ ...item, qty: newQty });
  };

  const decrement = () => {
    const newQty = item.qty - 1;
    if (newQty >= 0) {
      setItem({ ...item, qty: newQty });
    } else {
      setItem({ ...item, qty: 0 });
    }
  };

  const user = useAppSelector(selectUserData);
  const history = useHistory();

  const addItemToCart = async () => {
    if (user._id) {
      dispatch(
        addToCart({
          shopId: shopId,
          tableId: tableId,
          item: item,
        })
      );
    } else {
      history.push("/login");
    }
  };

  return (
    <>
      <Card className="MenuItem">
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
                {tableId && (
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
          </Col>
          <Col className="image-col ps-0" xs={4}>
            <Image
              src={menuItem?.image}
              rounded
              fluid
              className="w-100 h-100"
            />
            <div className="image-overlayer"></div>
            {tableId && (
              <Button
                className="add-button"
                // variant="outline-primary"
                size="sm"
                onClick={addItemToCart}
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
