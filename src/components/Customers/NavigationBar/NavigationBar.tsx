import { useEffect } from "react";
import { Container, Nav, Navbar } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchAllShops, fetchShopList } from "../../../redux/slices/shopSlice";
import { fetchUserData } from "../../../redux/slices/userSlice";
import { AiFillHome, AiOutlineHome } from "react-icons/ai";
import { IoCart, IoCartOutline } from "react-icons/io5";
import { FaRegUserCircle, FaUserCircle } from "react-icons/fa";
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
    // dispatch(fetchShopList())
  }, []);

  useEffect(() => {
    dispatch(getTableCart(tableId));
  }, [tableId]);

  const items = useAppSelector(selectCartsData).items.filter(
    (item) => item.qty > item.qtyPayed!
  );
  const itemsQty = items.reduce((total, item) => total + item.qty, 0);

  console.log("items: ", items);
  console.log("itemsQty: ", itemsQty);

  return (
    <>
      <Container className="NavigationBar" fluid>
        <Navbar className="p-0" fixed="bottom" bg="light" variant="light">
          <Container>
            {/* <Navbar.Brand href="#home">Navbar</Navbar.Brand> */}
            <Nav className="mx-auto align-items-center">
              {/* <Nav.Link className="me-4" href="/"> */}
              <Link className="nav-link me-4" to={`/`}>
                <AiOutlineHome size={35} />
                {/* <AiFillHome/> */}
              </Link>
              {/* </Nav.Link> */}
              {/* <Nav.Link href={`/shops/${shopId}/tables/${tableId}/cart`}> */}
              <Link
                className="cart-link nav-link mx-5"
                to={`/shops/${shopId}/tables/${tableId}/cart`}
              >
                <IoCartOutline className="mt-1" size={35} />
                {itemsQty > 0 && (
                  <span className="qty-indicator text-primary">{itemsQty}</span>
                )}
                {/* <IoCart/> */}
              </Link>
              {/* </Nav.Link> */}
              {/* <Nav.Link className="ms-4" href=""> */}
              <Link className="nav-link ms-4" to={`/myAccount`}>
                <FaRegUserCircle size={30} />
                {/* <FaUserCircle/> */}
              </Link>
              {/* </Nav.Link> */}
            </Nav>
          </Container>
        </Navbar>
      </Container>
    </>
  );
};

export default NavigationBar;
