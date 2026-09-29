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
      .then(({ data }) => {
        const next: Record<string, ITableStatus> = Object.fromEntries(data.map((s) => [s.tableId, s]));
        // Unchanged since the last refresh: keep the same object, so the
        // cards don't all render again for nothing.
        setStatuses((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      })
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

      {/* Add Table stays centred, like the rest of the page, and the print action sits
          at the right edge: two equal rails either side (TableList.css). */}
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
            {/* Icon only below sm: with its label it doesn't fit beside Add Table
                on a 320px screen. The aria-label above names it. */}
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
