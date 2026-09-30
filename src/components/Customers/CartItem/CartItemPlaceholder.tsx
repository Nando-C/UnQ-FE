import { Card } from "react-bootstrap";
import "./CartItem.css";

// A cart row's shape while the cart loads (see Loading).
const CartItemPlaceholder = () => (
  <div className="CartRow">
    <div className="cart-check" />
    <Card className="CartItem">
      <span className="placeholder cart-thumb rounded" />
      <div className="cart-body">
        <span className="placeholder placeholder-lg col-7 d-block mb-2" />
        <span className="placeholder placeholder-sm col-4 d-block mb-3" />
        <span className="placeholder placeholder-lg col-3 d-block" />
      </div>
    </Card>
  </div>
);

export default CartItemPlaceholder;
