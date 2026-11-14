import React, { Suspense, lazy, useEffect } from "react";
import "./App.css";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import Register from "./components/Register/Register";
import Login from "./components/Login/Login";
import Dashboard from "./components/Dashboard/Dashboard";
import ShopDetails from "./components/Shops/ShopDetails/ShopDetails";
import { useAppDispatch, useAppSelector } from "./redux/app/hooks";
import { fetchUserData, selectUserStatus } from "./redux/slices/userSlice";
import { loadShopList } from "./redux/slices/shopSlice";
import Cart from "./components/Customers/Cart/Cart";
import NavigationBar from "./components/Customers/NavigationBar/NavigationBar";
import TableMenu from "./components/Customers/TableMenu/TableMenu";
import Account from "./components/Customers/Account/Account";
import ShopNavbar from "./components/Shops/ShopNavbar/ShopNavbar";
import NotFound from "./components/NotFound/NotFound";
import { AdminOnly, ManagerOnly } from "./components/Common/Guards";
import Accounts from "./components/Admin/Accounts/Accounts";
import SalesFallback from "./components/Shops/Sales/SalesFallback";
import { DINER_ROUTES, isDinerPage, rememberShell, useRunsShops } from "./lib/shell";

// The sales page brings the charting library, which only managers who open
// it need: a chunk of its own, loaded then.
const Sales = lazy(() => import("./components/Shops/Sales/Sales"));

function App() {
  return (
    <Router>
      <Shell />
    </Router>
  );
}

// The shell around every page: the header or the tab bar, and the routes.
function Shell() {
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
  // the bottom tab bar. Until that is known, the shell drawn last time
  // (lib/shell.ts), kept for the next load once it is.
  const { runsShops, toRemember } = useRunsShops();
  useEffect(() => {
    if (toRemember !== null) rememberShell(toRemember);
  }, [toRemember]);

  // On a table's menu and cart they are a diner like anyone else: the tab
  // bar, with its link to the cart.
  const { pathname } = useLocation();
  const isManager = runsShops && !isDinerPage(pathname);

  return (
    <div className={isManager ? "App bg-light is-manager" : "App bg-light"}>
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
          <Route path={DINER_ROUTES.shopMenu} element={<TableMenu />} />
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
            path={DINER_ROUTES.tableMenu}
            element={<TableMenu />}
          />
          <Route
            path={DINER_ROUTES.cart}
            element={<Cart />}
          />
          <Route path="/myAccount" element={<Account />} />
          {/* The administrator's accounts page. */}
          <Route
            path="/admin/accounts"
            element={
              <AdminOnly>
                <Accounts />
              </AdminOnly>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
