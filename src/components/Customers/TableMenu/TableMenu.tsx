import { useEffect, useState } from "react";
import {
  Card,
  Col,
  Container,
  FloatingLabel,
  Form,
  ListGroup,
  Row,
  Button,
} from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { selectCartPointers, storeCartPointers } from "../../../redux/slices/cartSlice";
import {
  fetchSingleShop,
  selectShopFailed,
  selectShopFor,
} from "../../../redux/slices/shopSlice";
import MenuItem from "../MenuItem/MenuItem";
import MenuItemPlaceholder from "../MenuItem/MenuItemPlaceholder";
import { HeadingPlaceholder, Loading, LoadFailed, NoMatch } from "../../Common/ScreenStates";
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
  const shop = useAppSelector((state) => selectShopFor(state, shopId));
  const failed = useAppSelector((state) => selectShopFailed(state, shopId));
  // A menu that failed to load still names the page (the retry is below).
  usePageTitle(shop ? shop.name : failed ? "Menu" : "");

  const q = query.toLowerCase();
  const matches =
    shop?.menu.filter(
      (menu) =>
        menu.category.toLowerCase().includes(q) ||
        menu.name.toLowerCase().includes(q) ||
        menu.short_description.toLowerCase().includes(q)
    ) ?? [];

  const headingSpace = !tableId ? "pt-4 pt-md-5" : "py-4 pt-md-5";

  return (
    <div className="Shop-Page bg-light">
      {/* Its space is kept from the start (TableMenu.css), so the menu
          below doesn't jump down when the shop, then its photo, arrive. */}
      <div className="shop-hero">
        {shop?.cover && <img src={shop.cover} alt="" />}
      </div>
      <Container className="phone-column">
        {/* While the shop loads, only its heading and the menu's placeholders
            show, and the page is swapped whole once it arrives: nothing below
            the heading is on screen to be pushed down, however many lines the
            shop's name wraps to. */}
        {shop ? (
          <div key="menu">
            <div className="text-center">
              <Card.Title as="h1" className={headingSpace}>
                {shop.name}
              </Card.Title>
              {!tableId && (
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
              <ListGroup className="px-0" variant="flush">
                {matches.map((menuItem) => (
                  <ListGroup.Item key={menuItem._id} className="px-0">
                    <MenuItem shopId={shopId} itemId={menuItem._id} />
                  </ListGroup.Item>
                ))}
              </ListGroup>
              <NoMatch
                count={matches.length}
                what="dishes"
                query={query}
                onClear={() => setQuery("")}
              />
            </div>
          </div>
        ) : (
          <div key="loading" className="mb-5">
            <div className="text-center">
              <Card.Title as="h1" className={headingSpace}>
                {failed ? (
                  "Menu"
                ) : (
                  <HeadingPlaceholder />
                )}
              </Card.Title>
            </div>
            {failed ? (
              <LoadFailed
                message="Couldn't load this menu."
                onRetry={() => dispatch(fetchSingleShop(shopId))}
              />
            ) : (
              <Loading label="Loading the menu">
                <ListGroup className="px-0" variant="flush">
                  {[0, 1, 2].map((i) => (
                    <ListGroup.Item key={i} className="px-0">
                      <MenuItemPlaceholder />
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </Loading>
            )}
          </div>
        )}
      </Container>
      <ShopTablesOffCanvas show={show} handleClose={handleClose} />
    </div>
  );
};

export default TableMenu;
