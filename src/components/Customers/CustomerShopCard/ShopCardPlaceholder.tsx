import { Card } from "react-bootstrap";
import "./CustomerShopCard.css";

// A shop card's shape while the shops load (see Loading).
const ShopCardPlaceholder = () => (
  <Card className="CustomerShopCard">
    <span className="placeholder card-img-top w-100" style={{ aspectRatio: "16 / 9" }} />
    <Card.Body>
      <span className="placeholder placeholder-lg col-7 d-block mb-2" />
      <span className="placeholder placeholder-sm col-10 d-block" />
    </Card.Body>
  </Card>
);

export default ShopCardPlaceholder;
