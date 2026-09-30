import { Card } from "react-bootstrap";
import "./MenuItem.css";

// A menu card's shape while the menu loads (see Loading).
const MenuItemPlaceholder = () => (
  <Card className="MenuItem">
    <div className="menu-media">
      <div className="menu-text">
        <span className="placeholder placeholder-lg col-6 d-block mb-2" />
        <span className="placeholder placeholder-sm col-9 d-block" />
      </div>
      <div className="menu-photo">
        <span className="placeholder w-100 h-100 rounded" />
      </div>
    </div>
    <div className="actions">
      <span className="placeholder placeholder-lg col-2" />
    </div>
  </Card>
);

export default MenuItemPlaceholder;
