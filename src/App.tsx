import React, { Suspense, lazy, useEffect } from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Register from "./components/Register/Register";
import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";
import ShopDetails from "./components/Shops/ShopDetails/ShopDetails";
import { useAppDispatch, useAppSelector } from "./redux/app/hooks";
import { fetchUserData, selectUserStatus } from "./redux/slices/userSlice";
import { loadShopList, selectIsManager } from "./redux/slices/shopSlice";
import Cart from "./components/Customers/Cart/Cart";
import NavigationBar from "./components/Customers/NavigationBar/NavigationBar";
import TableMenu from "./components/Customers/TableMenu/TableMenu";
import Account from "./components/Customers/Account/Account";
import ShopNavbar from "./components/Shops/ShopNavbar/ShopNavbar";
import NotFound from "./components/NotFound/NotFound";
import { ManagerOnly } from "./components/Common/Guards";
import SalesFallback from "./components/Shops/Sales/SalesFallback";

// The sales page brings the charting library, which only managers who open
// it need: a chunk of its own, loaded then.
const Sales = lazy(() => import("./components/Shops/Sales/Sales"));

function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchUserData());
  }, [dispatch]);

  // Every signed-in account loads the shops it is a member of (one small
  // request, answering [] for a diner): they decide the shell, with the role.
  const status = useAppSelector(selectUserStatus);
  useEffect(() => {
    if (status === "authenticated") dispatch(loadShopList());
  }, [status, dispatch]);

  // Whoever runs a shop (a shop manager or an administrator by role, or a
  // member of a shop) gets the manager header, everyone else (diners, guests)
  // the bottom tab bar.
  const isManager = useAppSelector(selectIsManager);

  return (
    <div className={isManager ? "App bg-light is-manager" : "App bg-light"}>
      <Router>
        {/* Hidden until focused: the first Tab stop skips the header. */}
        <a className="visually-hidden-focusable skip-link" href="#main">
          Skip to content
        </a>
        {isManager ? <ShopNavbar /> : <NavigationBar />}
        <main id="main" tabIndex={-1}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Dashboard />} />
            {/* A shop's menu opened from the shop list, before picking a table. */}
            <Route path="/customer/shop/:shopId" element={<TableMenu />} />
            {/* The manager's page for one of their shops. */}
            <Route
              path="/shop/:shopId"
              element={
                <ManagerOnly>
                  <ShopDetails />
                </ManagerOnly>
              }
            />
            {/* The shop's sales report (the Sales tab). */}
            <Route
              path="/shop/:shopId/sales"
              element={
                <ManagerOnly>
                  <Suspense fallback={<SalesFallback />}>
                    <Sales />
                  </Suspense>
                </ManagerOnly>
              }
            />
            {/* A table's menu: where a table's QR code leads. */}
            <Route
              path="/shops/:shopId/tables/:tableId"
              element={<TableMenu />}
            />
            <Route
              path="/shops/:shopId/tables/:tableId/cart"
              element={<Cart />}
            />
            <Route path="/myAccount" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </Router>
    </div>
  );
}

export default App;
