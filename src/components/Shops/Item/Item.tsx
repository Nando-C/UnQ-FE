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

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const dispatch = useAppDispatch();

  const updateAvailable = async () => {
    await backend.put(`/shops/${shopId}/menu/${itemId}`, {
      available: !menuItem?.available,
    });
    dispatch(fetchShopList());
  };

  if (!menuItem) return null;

  return (
    <>
      <div className="Item text-center">
        <Card className="p-3">
          {/* text-start, like the description below, against the .Item text-center.
              The edit button is absolutely positioned top-right, so nothing collides. */}
          <Card.Title className="text-start">{menuItem?.name}</Card.Title>
          <Row className="align-items-start">
            {/* pe-md-4/pb-md-4 set the image off from the text once the columns are
                side by side, equally on both axes: 36px to the right of the image and
                36px below it. Note pe-md-4 REPLACES the column's 12px gutter padding
                rather than adding to it (24px -> 36px, not 24px -> 48px), while pb-md-4
                lands on the same 36px by stacking with the following row's mt-3 and the
                -4px margin-top Bootstrap puts on .card-subtitle. Same utility step, two
                different sums — measured, not assumed. */}
            <Col className="image-col mb-3 mb-md-0 pe-md-4 pb-md-4" xs={12} md={4}>
              <Image
                src={menuItem?.image}
                rounded
                fluid
                className="w-100 h-100"
              />
            </Col>
            <Col className="text-start" xs={12} md={4}>
              <Card.Subtitle>Short Description</Card.Subtitle>
              <Card.Body className="px-0">
                {menuItem?.short_description}
              </Card.Body>
            </Col>
            <Col className="d-flex flex-column" xs={12} md={4}>
              {/* xs={6} so these two never stack against each other: two single data
                  points do not earn four stacked lines on a phone, and stacking them
                  pushed the description below the fold. d-flex/d-md-block then puts each
                  label beside its value while stacked, and restores the label-above-value
                  arrangement once there is room at md. */}
              <Row className="">
                <Col xs={6} md={6}>
                  <div className="value-pair d-flex d-md-block align-items-center justify-content-start justify-content-md-center gap-2">
                    <Card.Subtitle>Price</Card.Subtitle>
                    <Card.Body className="p-0 p-md-3">
                      <span className="price text-primary">
                        £ {menuItem?.price}
                      </span>
                    </Card.Body>
                  </div>
                </Col>
                <Col xs={6} md={6}>
                  <div className="value-pair d-flex d-md-block align-items-center justify-content-end gap-2">
                    <Card.Subtitle>Available</Card.Subtitle>
                    <Form className="py-0 py-md-4">
                      <Form.Check
                        type="switch"
                        // Unique per item: a shop menu renders many of these, and the
                        // shared "custom-switch" id put duplicate ids on the page, so
                        // every generated label pointed at the first item's switch.
                        id={`available-${menuItem._id}`}
                        checked={menuItem.available}
                        onChange={() => updateAvailable()}
                        // label="Available"
                      />
                    </Form>
                  </div>
                </Col>
              </Row>
            </Col>
            {/* <Button className="" onClick={handleShow} >Edit Item</Button> */}
          </Row>
          {/* Full width and last: the long description is the only field here that runs
              to several lines, and in a quarter-width column it set a ragged measure and
              stretched the whole row to its height. Across the card it reads as a normal
              paragraph and stops driving the layout above it. */}
          <Row className="mt-3">
            {/* text-start overrides the .Item text-center it would otherwise inherit.
                Now that this runs the width of the card it is a real paragraph, and
                centring gives every line a different start point, so the eye has to
                hunt for the next one. */}
            <Col className="text-start" xs={12}>
              <Card.Subtitle>Full Description</Card.Subtitle>
              <Card.Body className="px-0">{menuItem?.description}</Card.Body>
            </Col>
          </Row>
          <Button size={"lg"} onClick={handleShow}>
            <GrEdit />
          </Button>
        </Card>
        <ItemModal
          shopId={shopId}
          show={show}
          handleClose={handleClose}
          itemId={menuItem._id}
        />
      </div>
    </>
  );
};

export default Item;
