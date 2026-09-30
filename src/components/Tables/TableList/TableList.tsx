import { useCallback, useState } from "react";
import { Button, Row, Col } from "react-bootstrap";
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
    <section id="tableList" className="shop-section" aria-labelledby="table-list-heading">
      <div className="page-head d-print-none">
        <h2 id="table-list-heading" className="h5">
          Tables
        </h2>
        <div className="actions">
          <Button
            variant="outline-primary"
            onClick={() => window.print()}
            disabled={tableCount === 0}
            title="Print QR codes"
            aria-label="Print QR codes"
          >
            {/* Icon only below sm, so both actions fit beside the heading on a
                320px screen. The aria-label above names it. */}
            <FaPrint className="me-sm-2" />
            <span className="d-none d-sm-inline">Print QR codes</span>
          </Button>
          <Button onClick={handleShow}>Add table</Button>
        </div>
      </div>

      {/* Paper only. A printed sheet of codes is useless if you cannot tell which shop
          it belongs to, but that heading would be redundant on screen. */}
      <h2 className="d-none d-print-block mb-4">{shop?.name}</h2>

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
    </section>
  );
};

export default TableList;
