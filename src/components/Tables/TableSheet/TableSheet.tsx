import { useCallback, useState } from "react";
import { Alert, Badge, Modal, Spinner } from "react-bootstrap";
import { FiAlertTriangle } from "react-icons/fi";
import backend from "../../../backend/backend";
import { useVisiblePolling } from "../../../lib/useVisiblePolling";
import { formatPrice } from "../../../lib/price";
import { menuIdOf } from "../../../lib/cart";
import { clockTime, heldFor, STATE_CLASS, STATE_LABEL } from "../../../lib/tables";
import { IManagerCart, ITableCarts, ITableStatus } from "../../../typings/tables";
import "./TableSheet.css";

// How often an open sheet refreshes (the table cards refresh every 30 s).
const REFRESH_MS = 20_000;

interface TableSheetProps {
  shopId: string;
  tableId: string;
  tableName: string;
  status?: ITableStatus;
  show: boolean;
  handleClose: () => void;
}

// One table as the manager sees it: what's in its open cart (ordered, paid and
// selected per item), who has selected what and for how long, the payments
// made, and the carts closed in the last 24 hours. Read-only.
const TableSheet = ({ shopId, tableId, tableName, status, show, handleClose }: TableSheetProps) => {
  const [carts, setCarts] = useState<ITableCarts | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    backend
      .get<ITableCarts>(`/shops/${shopId}/tables/${tableId}/carts`)
      .then(({ data }) => {
        setCarts(data);
        setError(false);
      })
      // Keep what's shown; say it may be out of date.
      .catch(() => setError(true));
  }, [shopId, tableId]);

  useVisiblePolling(load, REFRESH_MS, show);

  const open = carts?.open ?? [];
  const closed = carts?.recentlyClosed ?? [];

  return (
    <Modal
      className="TableSheet d-print-none"
      show={show}
      onHide={handleClose}
      size="lg"
      fullscreen="sm-down"
      scrollable
    >
      <Modal.Header closeButton>
        <Modal.Title>Table {tableName}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {status && (
          <p className="d-flex flex-wrap align-items-center gap-2">
            <span className={`badge rounded-pill ${STATE_CLASS[status.state]}`}>
              {STATE_LABEL[status.state]}
            </span>
            <span>
              Owed <strong className="text-nowrap">{formatPrice(status.owed)}</strong>
            </span>
            <span>
              Paid <strong className="text-nowrap">{formatPrice(status.paid)}</strong>
            </span>
          </p>
        )}
        {error && (
          <Alert variant="warning" className="py-2">
            Couldn't refresh this table. What's shown may be out of date.
          </Alert>
        )}
        {!carts && !error && (
          <div className="text-center py-4">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading table</span>
            </Spinner>
          </div>
        )}
        {carts && open.length === 0 && (
          <p className="text-body-secondary">No open cart: this table is free.</p>
        )}
        {open.map((cart, i) => (
          <section key={cart._id} className="mb-4">
            {open.length > 1 && (
              <h3 className="h6">
                Open cart {i + 1} of {open.length}
                {i === 0 ? " (the one diners see)" : " (not shown to diners)"}
              </h3>
            )}
            <CartDetails cart={cart} />
          </section>
        ))}
        {closed.length > 0 && (
          <details className="mt-3">
            <summary>Closed in the last 24 hours ({closed.length})</summary>
            {closed.map((cart) => (
              <section key={cart._id} className="mt-3">
                <h3 className="h6">
                  Closed {cart.updatedAt ? clockTime(cart.updatedAt) : ""}
                </h3>
                <Payments cart={cart} />
              </section>
            ))}
          </details>
        )}
      </Modal.Body>
    </Modal>
  );
};

// ---------------------------------------------------------------------------

const CartDetails = ({ cart }: { cart: IManagerCart }) => {
  const selections = cart.split.filter((s) => s.splitStatus === "open");
  const selectedOf = (menuId: string | undefined) =>
    selections
      // The manager endpoint always populates menuId.
      .filter((s) => s.menuId?._id === menuId)
      .reduce((sum, s) => sum + s.qty, 0);

  return (
    <>
      <h4 className="h6 mt-2">Items</h4>
      {cart.items.length === 0 ? (
        <p className="text-body-secondary small">Nothing ordered.</p>
      ) : (
        <ul className="list-unstyled sheet-list">
          {cart.items.map((item) => {
            const menuId = menuIdOf(item);
            const soldOut = item.menuId?.available === false;
            return (
              <li key={item._id ?? menuId}>
                <div className="d-flex flex-wrap justify-content-between gap-1">
                  <span>
                    {item.menuId?.name ?? "Item"}
                    {soldOut && (
                      <Badge bg="light" text="dark" className="ms-2 border">
                        Sold out
                      </Badge>
                    )}
                  </span>
                  <span className="text-nowrap">{formatPrice(item.menuId?.price)}</span>
                </div>
                <div className="small text-body-secondary">
                  Ordered {item.qty} · Paid {item.qtyPayed ?? 0} · Selected {selectedOf(menuId)}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h4 className="h6 mt-3">Selected to pay</h4>
      {selections.length === 0 ? (
        <p className="text-body-secondary small">No one is paying right now.</p>
      ) : (
        <ul className="list-unstyled sheet-list">
          {selections.map((s) => {
            const long = s.claimedAt && Date.now() - new Date(s.claimedAt).getTime() > 15 * 60000;
            return (
              <li key={s._id}>
                {s.userId?.name ?? "A diner"}: {s.qty}× {s.menuId?.name ?? "item"}
                {s.claimedAt && (
                  <span className={`small ms-2 ${long ? "text-danger-emphasis" : "text-body-secondary"}`}>
                    {long && <FiAlertTriangle aria-hidden className="me-1 align-text-bottom" />}
                    held {heldFor(s.claimedAt)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Payments cart={cart} />
    </>
  );
};

// Payments on a cart: the recorded ones in full, and any paid units from before
// payments were recorded as one "details unavailable" line.
const Payments = ({ cart }: { cart: IManagerCart }) => {
  const payments = cart.payments ?? [];
  const legacy = cart.split.filter((s) => s.splitStatus === "closed" && s.unitPrice === undefined);

  return (
    <>
      <h4 className="h6 mt-3">Payments</h4>
      {payments.length === 0 && legacy.length === 0 ? (
        <p className="text-body-secondary small">No payments yet.</p>
      ) : (
        <ul className="list-unstyled sheet-list">
          {payments.map((p) => (
            <li key={p._id}>
              <div className="d-flex flex-wrap justify-content-between gap-1">
                <span>
                  {p.userId?.name ?? "A diner"} · {clockTime(p.paidAt)}
                </span>
                <strong className="text-nowrap">{formatPrice(p.amount)}</strong>
              </div>
              <div className="small text-body-secondary">
                {p.lines.map((l) => `${l.qty}× ${l.name}`).join(", ")}
              </div>
            </li>
          ))}
          {legacy.length > 0 && (
            <li>
              <div>Paid, details unavailable</div>
              <div className="small text-body-secondary">
                {legacy.map((s) => `${s.qty}× ${s.menuId?.name ?? "item"}`).join(", ")}
              </div>
            </li>
          )}
        </ul>
      )}
    </>
  );
};

export default TableSheet;
