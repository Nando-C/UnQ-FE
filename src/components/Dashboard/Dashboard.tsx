import { useAppDispatch, useAppSelector } from "../../redux/app/hooks";
import { Container, Button } from "react-bootstrap";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { takeReturnTo } from "../../lib/returnTo";
import { fetchUserData, selectUserData } from "../../redux/slices/userSlice";
import ShopList from "../Shops/ShopList/ShopList";
import { fetchShopList } from "../../redux/slices/shopSlice";
import ShopModal from "../Shops/ShopModal/ShopModal";
import AllShopsList from "../Customers/AllShopsList/AllShopsList";
import { usePageTitle } from "../../lib/usePageTitle";
import "./Dashboard.css";

const Dashboard = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchUserData());
  }, [dispatch]);

  const userDataStore = useAppSelector(selectUserData);
  const isManager = userDataStore.role === "shopMg" ? true : false;
  usePageTitle(isManager ? "My Shops" : "Shops");

  // Google sign-in comes back here, to the site root: a diner who started it
  // at a table goes back to that table.
  const navigate = useNavigate();
  const signedIn = !!userDataStore._id;
  useEffect(() => {
    if (!signedIn) return;
    const back = takeReturnTo();
    if (back) navigate(back, { replace: true });
  }, [signedIn, navigate]);

  useEffect(() => {
    if (isManager) {
      dispatch(fetchShopList());
    }
  }, [isManager, dispatch]);

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      {isManager ? (
        <Container className="MyShops">
          <div className="page-head">
            <h1>My Shops</h1>
            <Button onClick={handleShow}>Add Shop</Button>
          </div>
          <ShopList />
          <ShopModal show={show} handleClose={handleClose} shopId={"new"} />
        </Container>
      ) : (
        <Container>
          <AllShopsList />
        </Container>
      )}
    </>
  );
};

export default Dashboard;
