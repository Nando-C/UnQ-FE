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
  selectSelectedShop,
} from "../../../redux/slices/shopSlice";
import MenuItem from "../MenuItem/MenuItem";
import ShopTablesOffCanvas from "../ShopTablesOffCanvas/ShopTablesOffCanvas";
import "./TableMenu.css";
import { tablePath } from "../../../lib/paths";

const TableMenu = () => {
  const { shopId = "", tableId = "" } = useParams<{
    shopId: string;
    tableId: string;
  }>();
  // console.log("shopId: ", shopId)
  // console.log("tableId: ", tableId)

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

  // Cheap staleness mitigation, like the cart's: the menu has no live updates,
  // so refresh it when a customer returns to this tab — an item may have sold
  // out meanwhile. A tab left in the foreground still relies on the "just sold
  // out" message MenuItem shows when an add is refused.
  useEffect(() => {
    const onFocus = () => dispatch(fetchSingleShop(shopId));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [dispatch, shopId]);

  const shop = useAppSelector(selectSelectedShop);
  // console.log("This Shop: ", shop)

  return (
    <div className="Shop-Page bg-light">
      <Image
        src={shop?.cover}
        fluid
        className="w-100"
        style={{ objectFit: "cover", maxHeight: "30vh" }}
      />
      <Container className="phone-column">
        <div className="text-center">
          <Card.Title className={!tableId ? "pt-4 pt-md-5" : "py-4 pt-md-5"}>
            {shop?.name}
          </Card.Title>
          {!tableId && (
            <Button onClick={handleShow} className="mt-3 mb-5 px-4">
              Select table to place order
            </Button>
          )}
        </div>
        <Row>
          <Col>
            <Form.Group className="search-bar mb-3" controlId="formBasicEmail">
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
        <Card.Subtitle className="mb-1 mt-4 fw-bold"> MENU </Card.Subtitle>
        <ListGroup className="px-0 mb-5" variant="flush">
          {shop?.menu &&
            shop.menu
              .filter(
                (menu) =>
                  menu.category.toLowerCase().includes(query.toLowerCase()) ||
                  menu.name.toLowerCase().includes(query.toLowerCase()) ||
                  menu.short_description
                    .toLowerCase()
                    .includes(query.toLowerCase())
              )
              .map((menuItem) => (
                <ListGroup.Item key={menuItem._id} className="px-0 menu-item">
                  <MenuItem shopId={shopId} itemId={menuItem._id} />
                </ListGroup.Item>
              ))}
        </ListGroup>
      </Container>
      <ShopTablesOffCanvas show={show} handleClose={handleClose} />
    </div>
  );
};

export default TableMenu;
