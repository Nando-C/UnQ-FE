import { Card, ListGroup, Offcanvas } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectSelectedShop } from "../../../redux/slices/shopSlice";
import "./ShopTablesOffCanvas.css";
import { tablePath } from "../../../lib/paths";

interface AccountOffCanvasProps {
  show: boolean;
  handleClose: () => void;
}

const ShopTablesOffCanvas = ({ show, handleClose }: AccountOffCanvasProps) => {
  const shop = useAppSelector(selectSelectedShop);

  return (
    <>
      <Offcanvas
        className="ShopTablesOffCanvas bg-light"
        show={show}
        onHide={handleClose}
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Select Table</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <ListGroup>
            {shop?.tables.map((table) => (
              <ListGroup.Item key={table._id} className="px-0">
                <Link
                  to={tablePath(shop._id, table._id)}
                  onClick={handleClose}
                >
                  <Card>
                    <Card.Title className="m-0 p-1">{table.name}</Card.Title>
                  </Card>
                </Link>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

export default ShopTablesOffCanvas;
