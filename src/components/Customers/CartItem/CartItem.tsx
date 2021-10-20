import { useEffect, useState } from "react";
import { Card, Col, Row, Button, Image, Form } from "react-bootstrap";
import { useParams } from "react-router";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  addToSplit,
  decreaseSplit,
  deleteFromCart,
  getTableCart,
  removeFromSplit,
  selectCartsData,
} from "../../../redux/slices/cartSlice";
import { IItem, ISplitItem } from "../../../typings/cart";
import { RiDeleteBinLine } from "react-icons/ri";
import "./CartItem.css";

interface CartItemProps {
  cartId: string;
  itemId: string | undefined;
  selectedAll: boolean;
  setSelectedAll: React.Dispatch<React.SetStateAction<boolean>>;
}

const CartItem = ({
  cartId,
  itemId,
  selectedAll,
  setSelectedAll,
}: CartItemProps) => {
  const params = useParams<{ shopId: string; tableId: string }>();
  const shopId = params.shopId;
  const tableId = params.tableId;

  const cart = useAppSelector(selectCartsData);
  const cartItem = cart.items.find((item) => item._id === itemId);
  const splitItem = cart.split.find(
    (item) => item._id === itemId && item.splitStatus === "open"
  );
  const payed = cartItem!.qtyPayed;
  const itemQty = cartItem!.qty - payed!;

  const [selected, setSelected] = useState(false);

  const [split, setSplit] = useState<ISplitItem | undefined>({
    _id: "",
    userId: "",
    menuId: null,
    qty: 0,
    splitStatus: "",
  });

  const [item, setItem] = useState<IItem | undefined>({
    _id: "",
    menuId: null,
    qty: 1,
    qtyPayed: 0,
  });

  useEffect(() => {
    dispatch(getTableCart(tableId));
    setItem(cartItem);
    setSplit(splitItem);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setItem(cartItem);
    setSplit(splitItem);
    if (splitItem) {
      setSelected(true);
    } else {
      setSelected(false);
    }
  }, [cartItem, splitItem]);

  useEffect(() => {
    if (selectedAll) {
      increment();
    } else {
      removeItemFromSplit();
    }
  }, [selectedAll]); // eslint-disable-line react-hooks/exhaustive-deps

  const dispatch = useAppDispatch();

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedAll) {
      setSelectedAll(false);
      setSelected(false);
    } else {
      setSelected(!selected);
    }
    const splitExists = item?.menuId._id === split?.menuId._id;

    console.log("splitExists: ", splitExists);

    if (!selected && !splitExists) {
      console.log("add to split");
      increment();
    } else if (selected && splitExists) {
      console.log("remove from split");
      removeItemFromSplit();
    }
  };

  const increment = () => {
    //<====================   adds item to SPLIT Cart
    let quantity = 0;

    if (selectedAll) {
      if (split) {
        quantity = item!.qty - item!.qtyPayed! - split.qty;
        console.log("split -> quantity: ", quantity);
      } else {
        quantity = item!.qty - item!.qtyPayed!;
        console.log("selectedAll -> quantity: ", quantity);
      }
    } else {
      quantity = 1;
      console.log("quantity: ", quantity);
    }

    const plusItem = {
      ...item!,
      qty: quantity,
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
    const minusItem = item!;

    dispatch(
      decreaseSplit({
        shopId: shopId,
        tableId: tableId,
        cartId: cartId,
        item: minusItem,
      })
    );
  };

  const removeItemFromSplit = () => {
    const minusItem = item!;
    dispatch(
      removeFromSplit({
        shopId: shopId,
        tableId: tableId,
        cartId: cartId,
        item: minusItem,
      })
    );
  };

  const deleteItemFromCart = () => {
    dispatch(
      deleteFromCart({
        shopId: shopId,
        tableId: tableId,
        item: item!,
      })
    );
  };

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
              onChange={(e) => handleSelect(e)}
            />
            {/* {console.log("selected: ",selected)} */}
          </Form.Group>
        </Col>
        <Col xs={11}>
          <Card className="CartItem">
            {/* <Badge
              bg={splitItem?.qty === itemQty ? "success" : "warning"}
              text="dark"
            >
              <small>
                {" "}
                Cart Qty: {splitItem?.qty ? itemQty - splitItem.qty : itemQty}
              </small>
            </Badge> */}
            <Row>
              <Col className="image-col pe-0 " xs={4}>
                <Image
                  src={item?.menuId?.image}
                  rounded
                  fluid
                  className="w-100 h-100"
                />
              </Col>
              <Col xs={8} className="text-start ps-2">
                <Row className="my-3">
                  <Col>
                    <Card.Subtitle className="ms-3">
                      {item?.menuId?.name}
                    </Card.Subtitle>
                    {/* <Card.Body className="ms-3 p-0">
                        <small>{item?.menuId?.short_description}</small>
                    </Card.Body> */}
                  </Col>
                  <Col xs="auto">
                    <span className="cart-qty-span">
                      <small>
                        in cart:{" "}
                        {splitItem?.qty ? itemQty - splitItem.qty : itemQty}
                      </small>
                    </span>
                  </Col>
                  {/* <Col>
                    <Badge pill bg="warning" text="dark">
                        <small> Cart Qty: {splitItem?.qty ? itemQty - splitItem.qty : itemQty}</small>
                    </Badge>
                    <Card.Text>
                        <small> Cart Qty: {splitItem?.qty ? itemQty - splitItem.qty : itemQty}</small>
                    </Card.Text>
                  </Col> */}
                </Row>
                <Row className="pb-1 align-items-center">
                  <Col className="p-0" xs={4}>
                    <Card.Body className="p-0 ms-3">
                      <span className="price text-primary">
                        £ {item?.menuId?.price}
                      </span>
                    </Card.Body>
                  </Col>
                  <Col xs={6}>
                    <Row className="quantity-wrapper text-center align-items-center">
                      <Col className="px-0">
                        {
                          selected || selectedAll ? (
                            <Button active size="sm" onClick={decrement}>
                              <strong>-</strong>
                            </Button>
                          ) : (
                            <></>
                          )
                          // <Button disabled size="sm" onClick={decrement} ><strong>-</strong></Button>
                        }
                      </Col>
                      <Col className="px-0">
                        <Card.Body className="p-0">
                          <small>{split?.qty}</small>
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
                        {/* <Button size="sm" onClick={decrement} ><strong>-</strong></Button> */}
                      </Col>
                    </Row>
                  </Col>
                  {/* <Col className="p-0" xs={1}>
                                        {selected
                                            ? <Button disabled size="sm" variant="danger" onClick={deleteItemFromCart}><RiDeleteBinLine/></Button>
                                            : <Button active size="sm" variant="danger" onClick={deleteItemFromCart}><RiDeleteBinLine/></Button>
                                        } */}
                  {/* <Button size="sm" variant="danger" onClick={deleteItemFromCart}><RiDeleteBinLine/></Button> */}
                  {/* </Col> */}
                </Row>
              </Col>
            </Row>
            {/* <Badge  bg="warning" text="dark">
                            <small> Cart Qty: {splitItem?.qty ? itemQty - splitItem.qty : itemQty}</small>
                        </Badge> */}
          </Card>
        </Col>
      </Row>
    </>
  );
};

export default CartItem;
