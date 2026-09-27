import { useAppDispatch, useAppSelector } from "../../redux/app/hooks";
import { Container, Button } from "react-bootstrap";
import { useEffect, useState } from "react";
import { fetchUserData, selectUserData } from "../../redux/slices/userSlice";
import ShopList from "../Shops/ShopList/ShopList";
import { fetchShopList } from "../../redux/slices/shopSlice";
import ShopModal from "../Shops/ShopModal/ShopModal";
import AllShopsList from "../Customers/AllShopsList/AllShopsList";
import "./Dashboard.css";

const Dashboard = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchUserData());
  }, [dispatch]);

  const userDataStore = useAppSelector(selectUserData);
  const isManager = userDataStore.role === "shopMg" ? true : false;

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
