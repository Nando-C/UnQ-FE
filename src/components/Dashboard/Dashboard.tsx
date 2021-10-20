import { useAppDispatch, useAppSelector } from "../../redux/app/hooks";
import { Container, Button } from "react-bootstrap";
import { useEffect, useState } from "react";
import { fetchUserData, selectUserData } from "../../redux/slices/userSlice";
import ShopList from "../Shops/ShopList/ShopList";
import { fetchShopList } from "../../redux/slices/shopSlice";
import ShopModal from "../Shops/ShopModal/ShopModal";
import AllShopsList from "../Customers/AllShopsList/AllShopsList";
// import NavigationBar from "../Customers/NavigationBar/NavigationBar"

const Dashboard = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchUserData());
  }, []);

  const userDataStore = useAppSelector(selectUserData);
  const isManager = userDataStore.role === "shopMg" ? true : false;

  if (isManager) {
    dispatch(fetchShopList());
  }

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      {isManager ? (
        <Container className="pt-5">
          <div className="my-4 px-3 d-flex justify-content-end">
            <Button className="me-3" onClick={handleShow}>
              Add Shop
            </Button>
          </div>
          <ShopList />
          <ShopModal show={show} handleClose={handleClose} shopId={"new"} />
        </Container>
      ) : (
        <Container>
          {/* <h2>User Dashboard</h2> */}
          <AllShopsList />
          {/* <TableMenu/> */}
          {/* <NavigationBar /> */}
        </Container>
      )}
    </>
  );
};

export default Dashboard;
