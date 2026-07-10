import { Container, Nav, Navbar } from "react-bootstrap";
import { FaRegUserCircle } from "react-icons/fa";
import { Link } from "react-router-dom";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectSelectedShop } from "../../../redux/slices/shopSlice";
import placeholder from "../../../assets/placeholder.svg";
import "./ShopNavbar.css";

const ShopNavbar = () => {
  const shop = useAppSelector(selectSelectedShop);

  return (
    <>
      <Navbar className="bg-white border-bottom py-1" fixed="top">
        <Container>
          <Navbar.Brand href="#home">
            <img
              src={placeholder}
              width="30"
              height="30"
              className="d-inline-block align-top"
              alt="UnQ logo"
            />
          </Navbar.Brand>
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
            </Link>
          </Nav>
        </Container>
      </Navbar>
    </>
  );
};

export default ShopNavbar;
