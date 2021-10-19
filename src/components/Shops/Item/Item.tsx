import { useState } from "react";
import { Card, Row, Col, Form, Image, Button } from "react-bootstrap";
import { GrEdit } from "react-icons/gr";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import ItemModal from "../ItemModal/ItemModal";
import "./Item.css";

interface ItemProps {
  itemId: string;
  shopId: string;
}

const Item = ({ itemId, shopId }: ItemProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const menuItem = shop?.menu.find((item) => item._id === itemId);

  const [available, setAvailable] = useState(menuItem!.available);

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const dispatch = useAppDispatch();

  const updateAvailable = async () => {
    const updatedItem = { ...menuItem, available: !available };
    const data = await backend.put(
      `/shops/${shopId}/menu/${itemId}`,
      updatedItem
    );
    console.log("updatedAvailable: ", data); //<=========================================== LOG
    dispatch(fetchShopList());
  };

  return (
    <>
      <div className="Item text-center">
        <Card className="p-3">
          <Card.Title>{menuItem?.name}</Card.Title>
          <Row className="align-items-start">
            <Col className="image-col" xs={12} md={3}>
              <Image
                src={menuItem?.image}
                rounded
                fluid
                className="w-100 h-100"
              />
            </Col>
            <Col xs={12} md={3}>
              <Card.Subtitle>Short Description</Card.Subtitle>
              <Card.Body className="px-0">
                {menuItem?.short_description}
              </Card.Body>
            </Col>
            <Col xs={12} md={3}>
              <Card.Subtitle>Full Description</Card.Subtitle>
              <Card.Body className="px-0">{menuItem?.description}</Card.Body>
            </Col>
            <Col className="d-flex flex-column" xs={12} md={3}>
              <Row className="">
                <Col xs={12} md={6}>
                  <Card.Subtitle>Price</Card.Subtitle>
                  <Card.Body>
                    <span className="price text-primary">
                      £ {menuItem?.price}
                    </span>
                  </Card.Body>
                </Col>
                <Col xs={12} md={6}>
                  <Card.Subtitle>Available</Card.Subtitle>
                  <Form className="py-4">
                    <Form.Check
                      type="switch"
                      id="custom-switch"
                      checked={available}
                      onChange={(e) => {
                        setAvailable(e.target.checked ? true : false);
                        updateAvailable();
                      }}
                      // label="Available"
                    />
                  </Form>
                </Col>
              </Row>
            </Col>
            {/* <Button className="" onClick={handleShow} >Edit Item</Button> */}
          </Row>
          <Button size={"lg"} onClick={handleShow}>
            <GrEdit />
          </Button>
        </Card>
        <ItemModal
          shopId={shopId}
          show={show}
          handleClose={handleClose}
          itemId={menuItem!._id}
        />
      </div>
    </>
  );
};

export default Item;
