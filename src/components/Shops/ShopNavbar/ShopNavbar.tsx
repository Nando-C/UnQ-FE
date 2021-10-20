import { Container, Nav, Navbar } from "react-bootstrap";
import { FaRegUserCircle } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectSelectedShop } from "../../../redux/slices/shopSlice";
import "./ShopNavbar.css";

const ShopNavbar = () => {
  const shop = useAppSelector(selectSelectedShop);

  return (
    <>
      <Navbar className="bg-white border-bottom py-1" fixed="top">
        <Container>
          <Navbar.Brand href="#home">
            <img
              src="https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png"
              width="30"
              height="30"
              className="d-inline-block align-top"
              alt="React Bootstrap logo"
            />
          </Navbar.Brand>
          {/* <Navbar.Toggle aria-controls="responsive-navbar-nav" /> */}
          {/* <Navbar.Collapse id="responsive-navbar-nav"> */}
          <Nav
            className={
              shop?._id
                ? "w-100 justify-content-around align-items-center"
                : "w-100 justify-content-between align-items-center"
            }
          >
            <Link className="nav-link" to={`/`}>
              My Shops
            </Link>
            {shop?._id && (
              <>
                <Nav.Link href="#shopDetails">Shop Details</Nav.Link>
                <Nav.Link href="#shopMenu">Menu</Nav.Link>
                <Nav.Link href="#tableList">Tables</Nav.Link>
              </>
            )}
            <Link className="nav-link" to={`/myAccount`}>
              <FaRegUserCircle size={30} />
              {/* My Account */}
            </Link>
          </Nav>
          {/* </Navbar.Collapse> */}
        </Container>
      </Navbar>
    </>
  );
};

export default ShopNavbar;
