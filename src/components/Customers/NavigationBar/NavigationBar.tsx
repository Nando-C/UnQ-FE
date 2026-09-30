import { useEffect, useRef } from "react";
import { Badge, Container, Nav, Navbar } from "react-bootstrap";
import { NavLink } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchAllShops } from "../../../redux/slices/shopSlice";
import { fetchUserData } from "../../../redux/slices/userSlice";
import { AiOutlineHome } from "react-icons/ai";
import { IoCartOutline } from "react-icons/io5";
import { FaRegUserCircle } from "react-icons/fa";
import { unpaidQty } from "../../../lib/cart";
import { usePublishedHeight } from "../../../lib/usePublishedHeight";
import "./NavigationBar.css";
import { tablePath } from "../../../lib/paths";
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

  // The bar's height (it grows with the text size) is published as
  // --unq-footer-h, which NavigationBar.css turns into the page's bottom
  // scroll padding, so a control reached with Tab is never left under the bar.
  const barRef = useRef<HTMLElement>(null);
  usePublishedHeight(barRef, "--unq-footer-h");

  const items = useAppSelector(selectCartsData).items.filter((item) => unpaidQty(item) > 0);
  const itemsQty = items.reduce((total, item) => total + unpaidQty(item), 0);

  return (
    <>
      <Container className="NavigationBar" fluid>
        <Navbar ref={barRef} className="p-0" fixed="bottom" bg="light" variant="light">
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
                  to={`${tablePath(shopId, tableId)}/cart`}
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
                // No table yet, so no cart to open. Named, and marked
                // unavailable, so a screen reader says why it does nothing.
                <span
                  className="cart-link nav-link"
                  role="link"
                  aria-disabled="true"
                  aria-label="Cart, choose a table first"
                >
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
