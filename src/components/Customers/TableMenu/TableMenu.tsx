import { useEffect, useState } from "react";
import {
  Card,
  Col,
  Container,
  FloatingLabel,
  Form,
  Image,
  ListGroup,
  Row,
  Button,
} from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { selectCartPointers, storeCartPointers } from "../../../redux/slices/cartSlice";
import {
  fetchSingleShop,
  selectSelectedFailed,
  selectSelectedShop,
} from "../../../redux/slices/shopSlice";
import MenuItem from "../MenuItem/MenuItem";
import MenuItemPlaceholder from "../MenuItem/MenuItemPlaceholder";
import { Loading, LoadFailed, NoMatch } from "../../Common/ScreenStates";
import ShopTablesOffCanvas from "../ShopTablesOffCanvas/ShopTablesOffCanvas";
import "./TableMenu.css";
import { tablePath } from "../../../lib/paths";
import { usePageTitle } from "../../../lib/usePageTitle";

// A shop's menu. With a table in the URL (a QR code's link) the diner can
// order; without one they browse and are offered the tables to pick from.
const TableMenu = () => {
  const { shopId = "", tableId = "" } = useParams<{
    shopId: string;
    tableId: string;
  }>();

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const [query, setQuery] = useState("");

  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // A diner at a table who opens the same shop from the shop list (after Home,
  // say) goes back to their table's menu, instead of this page forgetting the
  // table. Another shop starts without one.
  const pointers = useAppSelector(selectCartPointers);
  const backToTable =
    !tableId && pointers.shopId === shopId && pointers.tableId ? pointers.tableId : "";
  useEffect(() => {
    if (backToTable) {
      navigate(tablePath(shopId, backToTable), { replace: true });
    } else {
      dispatch(storeCartPointers({ shopId, tableId }));
    }
  }, [dispatch, navigate, shopId, tableId, backToTable]);
  useEffect(() => {
    dispatch(fetchSingleShop(shopId));
  }, [dispatch, shopId]);

  // Like the cart, the menu has no live updates, so it refreshes when the
  // diner comes back to this tab — an item may have sold out meanwhile. A tab left in the foreground still relies on the "just sold
  // out" message MenuItem shows when an add is refused.
  useEffect(() => {
    const onFocus = () => dispatch(fetchSingleShop(shopId));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [dispatch, shopId]);

  // The store may still hold the shop opened before this one: until this
  // shop's own arrives, the page shows placeholders, never the other's menu.
  const selected = useAppSelector(selectSelectedShop);
  const shop = selected?._id === shopId ? selected : null;
  const failed = useAppSelector(selectSelectedFailed) === shopId;
  usePageTitle(shop?.name ?? "");

  const q = query.toLowerCase();
  const matches =
    shop?.menu.filter(
      (menu) =>
        menu.category.toLowerCase().includes(q) ||
        menu.name.toLowerCase().includes(q) ||
        menu.short_description.toLowerCase().includes(q)
    ) ?? [];

  return (
    <div className="Shop-Page bg-light">
      {shop && (
        <Image
          src={shop.cover}
          fluid
          className="w-100"
          style={{ objectFit: "cover", maxHeight: "30vh" }}
        />
      )}
      <Container className="phone-column">
        <div className="text-center">
          <Card.Title as="h1" className={!tableId ? "pt-4 pt-md-5" : "py-4 pt-md-5"}>
            {shop ? (
              shop.name
            ) : (
              <span className="placeholder-glow" aria-hidden="true">
                <span className="placeholder col-6" />
              </span>
            )}
          </Card.Title>
          {!tableId && shop && (
            <Button onClick={handleShow} className="mt-3 mb-5 px-4">
              Select table to place order
            </Button>
          )}
        </div>
        <Row>
          <Col>
            <Form.Group className="search-bar mb-3">
              <FloatingLabel controlId="menu-search" label="Search Menu">
                <Form.Control
                  placeholder="Search Menu"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </FloatingLabel>
            </Form.Group>
          </Col>
        </Row>
        <Card.Subtitle as="h2" className="h6 mb-1 mt-4 fw-bold text-uppercase">
          Menu
        </Card.Subtitle>
        <div className="mb-5">
          {shop ? (
            <>
              <ListGroup className="px-0" variant="flush">
                {matches.map((menuItem) => (
                  <ListGroup.Item key={menuItem._id} className="px-0 menu-item">
                    <MenuItem shopId={shopId} itemId={menuItem._id} />
                  </ListGroup.Item>
                ))}
              </ListGroup>
              <NoMatch
                show={!!query.trim() && matches.length === 0}
                what="dishes"
                query={query}
                onClear={() => setQuery("")}
              />
            </>
          ) : failed ? (
            <LoadFailed
              message="Couldn't load this menu."
              onRetry={() => dispatch(fetchSingleShop(shopId))}
            />
          ) : (
            <Loading label="Loading the menu">
              <ListGroup className="px-0" variant="flush">
                {[0, 1, 2].map((i) => (
                  <ListGroup.Item key={i} className="px-0 menu-item">
                    <MenuItemPlaceholder />
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Loading>
          )}
        </div>
      </Container>
      <ShopTablesOffCanvas show={show} handleClose={handleClose} />
    </div>
  );
};

export default TableMenu;
