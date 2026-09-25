import { Container, Nav, Navbar } from "react-bootstrap";
import { FaRegUserCircle } from "react-icons/fa";
import { NavLink } from "react-router-dom";
import { useAppSelector } from "../../../redux/app/hooks";
import wordmark from "../../../assets/unq-wordmark-onematerial.svg";
import { selectSelectedShop } from "../../../redux/slices/shopSlice";
import "./ShopNavbar.css";

const ShopNavbar = () => {
  const shop = useAppSelector(selectSelectedShop);

  return (
    <>
      <Navbar className="ShopNavbar bg-white border-bottom py-1" fixed="top">
        <Container>
          <Navbar.Brand href="#home">
            <img
              src={wordmark}
              width="54"
              height="30"
              className="d-inline-block align-top"
              alt="UnQ"
            />
          </Navbar.Brand>
          <Nav
            className={
              shop?._id
                ? "w-100 justify-content-around align-items-center"
                : "w-100 justify-content-between align-items-center"
            }
          >
            {/* NavLink: teal while you're on the page (ShopNavbar.css). The
                three hash links below are plain anchors on purpose; see there. */}
            <NavLink className="nav-link" data-label="My Shops" to={`/`} end>
              My Shops
            </NavLink>
            {shop?._id && (
              <>
                <Nav.Link href="#shopDetails" data-label="Shop Details">Shop Details</Nav.Link>
                <Nav.Link href="#shopMenu" data-label="Menu">Menu</Nav.Link>
                <Nav.Link href="#tableList" data-label="Tables">Tables</Nav.Link>
              </>
            )}
            <NavLink
              className="nav-link"
              to={`/myAccount`}
              aria-label="Account"
            >
              <FaRegUserCircle size={30} />
            </NavLink>
          </Nav>
        </Container>
      </Navbar>
    </>
  );
};

export default ShopNavbar;
