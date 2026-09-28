import { useCallback, useState } from "react";
import { Button, Card, Row, Col } from "react-bootstrap";
import { FaPrint } from "react-icons/fa";
import { useAppSelector } from "../../../redux/app/hooks";
import backend from "../../../backend/backend";
import { useVisiblePolling } from "../../../lib/useVisiblePolling";
import { ITableStatus } from "../../../typings/tables";
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

  const tableCount = shop?.tables.length ?? 0;

  // Each table's state for its card, refreshed every 30 s while the page is in
  // view. A failed refresh keeps the last one; with none yet, the cards simply
  // show no status.
  const [statuses, setStatuses] = useState<Record<string, ITableStatus>>({});
  const loadStatuses = useCallback(() => {
    backend
      .get<ITableStatus[]>(`/shops/${shopId}/tables/status`)
      .then(({ data }) =>
        setStatuses(Object.fromEntries(data.map((s) => [s.tableId, s])))
      )
      .catch(() => {});
  }, [shopId]);
  useVisiblePolling(loadStatuses, 30_000, tableCount > 0);

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <div id="tableList" className="py-4">
      <hr className="d-print-none" />
      <Card.Title className="m-5 d-print-none">TABLES</Card.Title>

      {/* Paper only. A printed sheet of codes is useless if you cannot tell which shop
          it belongs to, but that heading would be redundant on screen. */}
      <h2 className="d-none d-print-block mb-4">{shop?.name}</h2>

      {/* Add Table stays optically centred — the page Container is text-center and it has
          always sat in the middle — so the print action is pushed to the right edge by a
          pair of equal flex-fill rails rather than by justify-content, which would drag
          Add Table over to the left. */}
      <div className="TableList-actions pb-5 d-print-none d-flex align-items-center gap-2">
        <div className="tl-rail" />
        <Button className="flex-shrink-0" onClick={handleShow}>
          Add Table
        </Button>
        <div className="tl-rail d-flex justify-content-end">
          <Button
            variant="outline-primary"
            className="flex-shrink-0"
            onClick={() => window.print()}
            disabled={tableCount === 0}
            title="Print QR Codes"
            aria-label="Print QR Codes"
          >
            {/* Below sm the label is dropped and this becomes an icon button. Both
                buttons refuse to shrink, so keeping the full label on a 320px screen
                made this one spill out of its rail and sit on top of Add Table. The
                aria-label above carries the name once the text is gone. */}
            <FaPrint className="me-sm-2" />
            <span className="d-none d-sm-inline">Print QR Codes</span>
          </Button>
        </div>
      </div>
      <Row>
        {shop?.tables.map((table) => (
          <Col key={table._id} className="mb-4" sm={12} md={6} lg={4} xl={3}>
            <SingleTable
              shopId={shopId}
              tableId={table._id}
              status={statuses[table._id]}
              onChanged={loadStatuses}
            />
          </Col>
        ))}
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
