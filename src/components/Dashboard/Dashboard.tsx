import { useAppDispatch, useAppSelector } from "../../redux/app/hooks";
import { Container, Button } from "react-bootstrap";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { takeReturnTo } from "../../lib/returnTo";
import { fetchUserData, selectUserData } from "../../redux/slices/userSlice";
import ShopList from "../Shops/ShopList/ShopList";
import { fetchShopList, selectIsManager } from "../../redux/slices/shopSlice";
import { canCreateShops } from "../../lib/membership";
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
  const isManager = useAppSelector(selectIsManager);
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

  // The account's shops, fresh each time the page opens (a shop deleted from
  // its page leaves the list here). The shell asks for them too, once: a
  // request still on its way makes that one unnecessary (loadShopList).
  useEffect(() => {
    if (signedIn) dispatch(fetchShopList());
  }, [signedIn, dispatch]);

  // Creating a shop takes the shop manager or administrator role; a member of
  // someone else's shop has no button.
  const canCreate = canCreateShops(userDataStore.role);

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      {isManager ? (
        <Container className="MyShops">
          <div className="page-head">
            <h1>My Shops</h1>
            {canCreate && <Button onClick={handleShow}>Add Shop</Button>}
          </div>
          <ShopList />
          {canCreate && <ShopModal show={show} handleClose={handleClose} shopId={"new"} />}
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
