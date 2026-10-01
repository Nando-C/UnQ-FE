import { useCallback, useState } from "react";
import { Button, Row, Col } from "react-bootstrap";
import { FaPrint } from "react-icons/fa";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import backend from "../../../backend/backend";
import { useVisiblePolling } from "../../../lib/useVisiblePolling";
import { ITableStatus } from "../../../typings/tables";
import { IDeletedTable } from "../../../typings/shop";
import SingleTable from "../SingleTable/SingleTable";
import TableSheet from "../TableSheet/TableSheet";
import TableModal from "../TableModal/TableModal";
import "./TableList.css";

interface ShopMenuProps {
  shopId: string;
}

// How long a deleted table is listed: its sheet shows its carts closed in the
// last 24 hours. One with something left to do stays listed until it's done.
const DELETED_SHOWN_MS = 24 * 60 * 60 * 1000;

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

  // The deleted table whose sheet is open: it stays listed until that closes.
  const [openDeleted, setOpenDeleted] = useState<string | null>(null);
  const recentlyDeleted = (shop?.deletedTables ?? []).filter(
    (table) =>
      table.needsAttention ||
      table._id === openDeleted ||
      Date.now() - Date.parse(table.deletedAt) < DELETED_SHOWN_MS
  );

  // Shown once the manager's shops have loaded (the menu above shows
  // placeholders meanwhile): with nothing below the menu while it loads,
  // however many items it turns out to have, nothing on screen is pushed down.
  if (!shop) return null;

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
      <h2 className="d-none d-print-block mb-4">{shop.name}</h2>

      <Row>
        {shop.tables.map((table) => (
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
      {recentlyDeleted.length > 0 && (
        <section className="d-print-none mb-4" aria-labelledby="deleted-tables-heading">
          <h3 id="deleted-tables-heading" className="h6">
            Deleted tables
          </h3>
          <p className="small text-body-secondary">
            Their recent carts, to refund or check if needed.
          </p>
          <div className="d-flex flex-wrap gap-2">
            {recentlyDeleted.map((table) => (
              <DeletedTable
                key={table._id}
                shopId={shopId}
                table={table}
                open={openDeleted === table._id}
                setOpen={(open) => setOpenDeleted(open ? table._id : null)}
              />
            ))}
          </div>
        </section>
      )}
      <TableModal
        shopId={shopId}
        show={show}
        handleClose={handleClose}
        tableId={"new"}
      />
    </section>
  );
};

// A deleted table: its name, opening its sheet. An action there can change
// whether it still needs attention, so the manager's shops are reloaded after.
interface DeletedTableProps {
  shopId: string;
  table: IDeletedTable;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DeletedTable = ({ shopId, table, open, setOpen }: DeletedTableProps) => {
  const dispatch = useAppDispatch();
  return (
    <>
      <Button
        variant="outline-secondary"
        onClick={() => setOpen(true)}
        aria-label={`View deleted table ${table.name}`}
      >
        {table.name}
      </Button>
      <TableSheet
        shopId={shopId}
        tableId={table._id}
        tableName={table.name}
        show={open}
        handleClose={() => setOpen(false)}
        onChanged={() => dispatch(fetchShopList())}
        deleted
      />
    </>
  );
};

export default TableList;
