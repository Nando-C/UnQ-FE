import { useState } from "react";
import {
  Button,
  ListGroup,
  Row,
  Col,
  Form,
  FloatingLabel,
} from "react-bootstrap";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList, selectShopsDataStatus } from "../../../redux/slices/shopSlice";
import Item from "../Item/Item";
import ItemPlaceholder from "../Item/ItemPlaceholder";
import { Loading, LoadFailed, NoMatch } from "../../Common/ScreenStates";
import ItemModal from "../ItemModal/ItemModal";

interface ShopMenuProps {
  shopId: string;
}
const ShopMenu = ({ shopId }: ShopMenuProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );

  const dispatch = useAppDispatch();
  const status = useAppSelector(selectShopsDataStatus);

  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const matches =
    shop?.menu.filter(
      (menu) =>
        menu.category.toLowerCase().includes(q) ||
        menu.name.toLowerCase().includes(q) ||
        menu.description.toLowerCase().includes(q)
    ) ?? [];

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <section id="shopMenu" className="ShopMenu shop-section" aria-labelledby="shop-menu-heading">
      <div className="page-head">
        <h2 id="shop-menu-heading" className="h5">
          Menu
        </h2>
        <div className="actions">
          <Button onClick={handleShow}>Add menu item</Button>
        </div>
      </div>
      <Row>
        <Col>
          <Form.Group className="mb-3">
            <FloatingLabel controlId="manager-menu-search" label="Search Menu">
              <Form.Control
                placeholder="Search Menu"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </FloatingLabel>
          </Form.Group>
        </Col>
      </Row>
      {/* The menu comes from the manager's own shops (ShopDetails loads them
          when needed): placeholders until they arrive. */}
      {shop ? (
        <>
          <ListGroup className="px-0" variant="flush">
            {matches.map((menuItem) => (
              <ListGroup.Item key={menuItem._id} className="px-0">
                <Item itemId={menuItem._id} shopId={shopId} />
              </ListGroup.Item>
            ))}
          </ListGroup>
          <NoMatch
            count={matches.length}
            what="menu items"
            query={query}
            onClear={() => setQuery("")}
          />
        </>
      ) : status === "failed" ? (
        <LoadFailed
          message="Couldn't load this shop's menu."
          onRetry={() => dispatch(fetchShopList())}
        />
      ) : status !== "ready" ? (
        <Loading label="Loading the menu">
          <ListGroup className="px-0" variant="flush">
            {[0, 1, 2].map((i) => (
              <ListGroup.Item key={i} className="px-0">
                <ItemPlaceholder />
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Loading>
      ) : null}
      <ItemModal
        shopId={shopId}
        show={show}
        handleClose={handleClose}
        itemId={"new"}
      />
    </section>
  );
};

export default ShopMenu;
