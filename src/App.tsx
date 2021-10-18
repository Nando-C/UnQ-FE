import React, { useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { BrowserRouter as Router, Route } from "react-router-dom";
import Register from "./components/Register/Register";
import Login from "./components/Login/Login";
// import Item from './components/Shop/Item/Item';
// import ItemList from './components/Shop/ItemList/ItemList';
import Dashboard from "./components/Dashboard/Dashboard";
import ShopDetails from "./components/Shops/ShopDetails/ShopDetails";
import { useAppDispatch } from "./redux/app/hooks";
import { fetchUserData } from "./redux/slices/userSlice";
import { fetchShopList } from "./redux/slices/shopSlice";
import Cart from "./components/Customers/Cart/Cart";
import NavigationBar from "./components/Customers/NavigationBar/NavigationBar";
import TableMenu from "./components/Customers/TableMenu/TableMenu";
import Account from "./components/Customers/Account/Account";
import ShopNavbar from "./components/Shops/ShopNavbar/ShopNavbar";

function App() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchUserData());
    dispatch(fetchShopList());
  }, []);

  return (
    <div className="App">
      <Router>
        {/* <ShopNavbar /> */}
        <Route exact path="/login" component={Login} />
        <Route exact path="/register" component={Register} />
        <Route exact path="/" component={Dashboard} />
        <Route exact path="/customer/shop/:shopId" component={TableMenu} />
        <Route exact path="/shop/:shopId" component={ShopDetails} />
        <Route
          exact
          path="/shops/:shopId/tables/:tableId"
          component={TableMenu}
        />
        <Route
          exact
          path="/shops/:shopId/tables/:tableId/cart"
          component={Cart}
        />
        <Route exact path="/myAccount" component={Account} />
        <NavigationBar />
      </Router>

      {/* <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header> */}
    </div>
  );
}

export default App;
