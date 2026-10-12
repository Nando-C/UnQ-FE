import { useRef } from "react";
import { Container, Navbar } from "react-bootstrap";
import { FaRegUserCircle } from "react-icons/fa";
import { Link, NavLink, useMatch } from "react-router-dom";
import wordmark from "../../../assets/unq-wordmark-onematerial.svg";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectSelectedShop } from "../../../redux/slices/shopSlice";
import ShopSectionNav from "../ShopSectionNav/ShopSectionNav";
import ShopName from "./ShopName";
import { usePublishedHeight } from "../../../lib/usePublishedHeight";
import "./ShopNavbar.css";

// The manager header. One row: the logo, a breadcrumb ("My Shops" on its own, or
// "My Shops › First Shop" on a shop's page), that shop's section tabs, and the account
// icon pinned to the right (the tabs: the shop page's sections, and its Sales page).
// Everything flows from the left, so the tabs and the shop's
// name appearing never move My Shops or the account icon. Below 640px there is no room
// for the tabs beside the breadcrumb, so they wrap onto a second row of their own
// (ShopNavbar.css); the breadcrumb row reads the same at every width.
const ShopNavbar = () => {
  // Keyed on the route, not on the selected shop in the store: the store keeps the
  // last shop after you go back to My Shops. A shop's pages are its own page and its
  // Sales page; the tabs appear on both.
  const shopPage = useMatch("/shop/:shopId");
  const salesPage = useMatch("/shop/:shopId/sales");
  const shopId = (shopPage ?? salesPage)?.params.shopId;
  const shop = useAppSelector(selectSelectedShop);
  // While a newly opened shop loads, the store still holds the previous one; show no
  // name rather than the wrong one.
  const shopName = shop && shop._id === shopId ? shop.name : null;

  // The header's height changes with the tabs row (phones only) and the viewport, so
  // it is measured and published as --unq-header-h. ShopNavbar.css turns that into
  // the page's scroll padding, so jumping to a section never lands it under the header;
  // ShopDetails pads its top by it; ShopSectionNav uses it to follow the scroll.
  const headerRef = useRef<HTMLElement>(null);
  usePublishedHeight(headerRef, "--unq-header-h");

  return (
    <header ref={headerRef} className="ShopHeader fixed-top">
      <Navbar className="ShopNavbar bg-white border-bottom py-1">
        <Container className="shop-bar">
          {/* The logo goes home (My Shops), as a logo is expected to. */}
          <Navbar.Brand as={Link} to="/">
            <img
              src={wordmark}
              width="54"
              height="30"
              className="d-inline-block align-top"
              alt="UnQ"
            />
          </Navbar.Brand>
          {/* navbar-nav for the navbar's link colours (ShopNavbar.css). */}
          <nav className="crumbs navbar-nav" aria-label="Breadcrumb">
            <NavLink className="nav-link" data-label="My Shops" to={`/`} end>
              My Shops
            </NavLink>
            {shopName && (
              <>
                <span className="crumb-sep" aria-hidden="true">
                  ›
                </span>
                <ShopName name={shopName} />
              </>
            )}
          </nav>
          {shopId && <ShopSectionNav shopId={shopId} salesPage={!!salesPage} />}
          <div className="account navbar-nav">
            <NavLink
              className="nav-link"
              to={`/myAccount`}
              aria-label="Account"
            >
              <FaRegUserCircle size={30} />
            </NavLink>
          </div>
        </Container>
      </Navbar>
    </header>
  );
};

export default ShopNavbar;
