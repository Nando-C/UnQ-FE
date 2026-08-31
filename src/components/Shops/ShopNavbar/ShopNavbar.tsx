import { Container, Nav, Navbar } from "react-bootstrap";
import { FaRegUserCircle } from "react-icons/fa";
import { Link } from "react-router-dom";
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
            <Link className="nav-link" data-label="My Shops" to={`/`}>
              My Shops
            </Link>
            {shop?._id && (
              <>
                <Nav.Link href="#shopDetails" data-label="Shop Details">Shop Details</Nav.Link>
                <Nav.Link href="#shopMenu" data-label="Menu">Menu</Nav.Link>
                <Nav.Link href="#tableList" data-label="Tables">Tables</Nav.Link>
              </>
            )}
            <Link className="nav-link" to={`/myAccount`}>
              <FaRegUserCircle size={30} />
            </Link>
          </Nav>
        </Container>
      </Navbar>
    </>
  );
};

export default ShopNavbar;
