import React from 'react';
import logo from './logo.svg';
import './App.css';
import { BrowserRouter as Router, Route } from 'react-router-dom';
import Register from './components/Register/Register';
import Login from './components/Login/Login';
// import Item from './components/Shop/Item/Item';
// import ItemList from './components/Shop/ItemList/ItemList';
import Dashboard from "./components/Dashboard/Dashboard"
import ShopDetails from './components/Shops/ShopDetails/ShopDetails';

function App() {
  return (
    <div className="App">
      <Router>
        <Route exact path="/login" component={Login}/>
        <Route exact path="/register" component={Register}/>
        <Route exact path="/" component={Dashboard}/>
        <Route exact path="/shop/:shopId" component={ShopDetails} />
      </Router>

      {/* <ItemList/> */}

      <header className="App-header">
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
      </header>
    </div>
  );
}

export default App;
