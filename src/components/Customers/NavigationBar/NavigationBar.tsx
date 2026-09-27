import { useEffect } from "react";
import { Badge, Container, Nav, Navbar } from "react-bootstrap";
import { NavLink } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchAllShops } from "../../../redux/slices/shopSlice";
import { fetchUserData } from "../../../redux/slices/userSlice";
import { AiOutlineHome } from "react-icons/ai";
import { IoCartOutline } from "react-icons/io5";
import { FaRegUserCircle } from "react-icons/fa";
import "./NavigationBar.css";
import {
  getTableCart,
  selectCartPointers,
  selectCartsData,
} from "../../../redux/slices/cartSlice";

const NavigationBar = () => {
  const dispatch = useAppDispatch();
  const { shopId, tableId } = useAppSelector(selectCartPointers);

  useEffect(() => {
    dispatch(fetchUserData());
    dispatch(fetchAllShops());
  }, [dispatch]);

  useEffect(() => {
    if (tableId) {
      dispatch(getTableCart(tableId));
    }
  }, [dispatch, tableId]);

  const items = useAppSelector(selectCartsData).items.filter(
    (item) => item.qty > (item.qtyPayed ?? 0)
  );
  const itemsQty = items.reduce(
    (total, item) => total + item.qty - (item.qtyPayed ?? 0),
    0
  );

  return (
    <>
      <Container className="NavigationBar" fluid>
        <Navbar className="p-0" fixed="bottom" bg="light" variant="light">
          <Container fluid className="px-0 bg-white border-top">
            {/* NavLink marks the page you're on (class "active" plus
                aria-current="page"), which NavigationBar.css turns teal. These
                three are real pages, so the highlight is always accurate. */}
            {/* Three equal cells, each at least 44px, instead of fixed
                margins between the icons (at large text sizes those margins
                pushed the account icon off the screen). Icons are sized in em
                (35px and 30px at the default 16px), so they grow with the
                phone's text size like everything else. */}
            <Nav className="bottom-tabs flex-nowrap">
              <NavLink className="nav-link" to={`/`} end aria-label="Home">
                <AiOutlineHome size="2.2em" />
              </NavLink>
              {shopId && tableId ? (
                <NavLink
                  className="cart-link nav-link"
                  to={`/shops/${shopId}/tables/${tableId}/cart`}
                  aria-label={
                    itemsQty > 0 ? `Cart, ${itemsQty} items` : "Cart"
                  }
                >
                  <span className="cart-icon">
                    <IoCartOutline className="mt-1" size="2.2em" />
                    {itemsQty > 0 && (
                      <Badge pill bg="primary" className="qty-indicator">
                        {itemsQty}
                      </Badge>
                    )}
                  </span>
                </NavLink>
              ) : (
                <span className="cart-link nav-link">
                  <span className="cart-icon">
                    <IoCartOutline className="mt-1" size="2.2em" />
                  </span>
                </span>
              )}
              <NavLink
                className="nav-link"
                to={`/myAccount`}
                aria-label="Account"
              >
                <FaRegUserCircle size="1.9em" />
              </NavLink>
            </Nav>
          </Container>
        </Navbar>
      </Container>
    </>
  );
};

export default NavigationBar;
