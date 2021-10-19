import { useState } from "react";
import { ListGroup, Button, Card, Row, Col } from "react-bootstrap";
import { useAppSelector } from "../../../redux/app/hooks";
import SingleTable from "../SingleTable/SingleTable";
import TableModal from "../TableModal/TableModal";
import "./TableList.css";

interface ShopMenuProps {
  shopId: string;
}

const TableList = ({ shopId }: ShopMenuProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <div id="tableList" className="py-4">
      <hr />
      <Card.Title className="m-5">TABLES</Card.Title>
      <div className="pb-5">
        <Button onClick={handleShow}>Add Table</Button>
      </div>
      <Row>
        {/* <ListGroup className="px-0" variant="flush"> */}
        {shop?.tables.map((table) => (
          <Col key={table._id} className="mb-4" sm={12} md={6} lg={4} xl={3}>
            {/* <ListGroup.Item key={table._id} className="px-0 menu-item"> */}
            <SingleTable shopId={shopId} tableId={table._id} />
            {/* </ListGroup.Item> */}
          </Col>
        ))}
        {/* </ListGroup> */}
      </Row>
      <TableModal
        shopId={shopId}
        show={show}
        handleClose={handleClose}
        tableId={"new"}
      />
    </div>
  );
};

export default TableList;
