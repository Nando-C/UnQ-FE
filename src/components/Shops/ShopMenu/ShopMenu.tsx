import { useState } from "react";
import {
  Card,
  Button,
  ListGroup,
  Row,
  Col,
  Form,
  FloatingLabel,
} from "react-bootstrap";
import { useAppSelector } from "../../../redux/app/hooks";
import Item from "../Item/Item";
import ItemModal from "../ItemModal/ItemModal";

interface ShopMenuProps {
  shopId: string;
}
const ShopMenu = ({ shopId }: ShopMenuProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );

  const [query, setQuery] = useState("");

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <div id="shopMenu" className="ShopMenu pt-4">
      <hr />
      <Card.Title className="m-5"> MENU </Card.Title>
      <Row>
        <Col>
          <Form.Group className="mb-3" controlId="formBasicEmail">
            <FloatingLabel controlId="floatingInput" label="Search Menu">
              <Form.Control
                placeholder="Search Menu"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </FloatingLabel>
          </Form.Group>
        </Col>
      </Row>
      <div className="my-3 text-align-end">
        <Button onClick={handleShow}>Add Menu Item</Button>
      </div>
      <ListGroup className="px-0" variant="flush">
        {shop?.menu
          .filter(
            (menu) =>
              menu.category.toLowerCase().includes(query.toLowerCase()) ||
              menu.name.toLowerCase().includes(query.toLowerCase()) ||
              menu.description.toLowerCase().includes(query.toLowerCase())
          )
          .map((menuItem) => (
            <ListGroup.Item key={menuItem._id} className="px-0 menu-item">
              <Item itemId={menuItem._id} shopId={shopId} />
            </ListGroup.Item>
          ))}
      </ListGroup>
      <ItemModal
        shopId={shopId}
        show={show}
        handleClose={handleClose}
        itemId={"new"}
      />
    </div>
  );
};

export default ShopMenu;
