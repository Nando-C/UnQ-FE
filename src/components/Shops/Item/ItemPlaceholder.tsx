import { Card } from "react-bootstrap";
import "./Item.css";

// A manager's menu row's shape while their shops load (see Loading).
const ItemPlaceholder = () => (
  <div className="Item text-start">
    <Card className="p-3">
      <div className="item-row">
        {/* Sized like .item-thumb, without its background, which would hide
            the placeholder's grey. */}
        <span
          className="placeholder rounded flex-shrink-0"
          style={{ width: "var(--item-thumb)", height: "var(--item-thumb)" }}
        />
        <div className="item-main">
          <span className="placeholder placeholder-lg col-6 d-block mb-2" />
          <span className="placeholder placeholder-sm col-9 d-block" />
        </div>
      </div>
    </Card>
  </div>
);

export default ItemPlaceholder;
