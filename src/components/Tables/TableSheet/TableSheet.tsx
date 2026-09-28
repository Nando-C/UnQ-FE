import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Alert, Badge, Button, Modal, Spinner } from "react-bootstrap";
import { FiAlertTriangle } from "react-icons/fi";
import backend from "../../../backend/backend";
import { useVisiblePolling } from "../../../lib/useVisiblePolling";
import { formatPrice } from "../../../lib/price";
import { menuIdOf } from "../../../lib/cart";
import { clockTime, heldFor, STATE_CLASS, STATE_LABEL } from "../../../lib/tables";
import { IManagerCart, IManagerSplit, ITableCarts, ITableStatus } from "../../../typings/tables";
import "./TableSheet.css";

// How often an open sheet refreshes (the table cards refresh every 30 s).
const REFRESH_MS = 20_000;
// The BE's answer when the cart changed between loading and saving.
const CART_CHANGED = "The cart changed, please retry";

interface TableSheetProps {
  shopId: string;
  tableId: string;
  tableName: string;
  status?: ITableStatus;
  show: boolean;
  handleClose: () => void;
  // After an action changed the table, so the card can refresh its status.
  onChanged?: () => void;
}

// A manager action waiting for confirmation. `message` says in plain words
// what will happen; `done` turns the BE's answer into what did.
interface PendingAction {
  message: string;
  confirmLabel: string;
  danger: boolean;
  send: () => Promise<{ data: unknown }>;
  done: (data: unknown) => string;
}
type Ask = (action: PendingAction) => void;

interface Result {
  variant: "success" | "warning" | "danger";
  text: string;
}

const errorText = (err: unknown) => {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return "Something went wrong, please try again.";
};

// "2× Latte"
const units = (qty: number, name: string | undefined) => `${qty}× ${name ?? "item"}`;
const unpaidOf = (item: IManagerCart["items"][number]) => item.qty - (item.qtyPayed ?? 0);

// One table as the manager sees it: what's in its open cart (ordered, paid and
// selected per item), who has selected what and for how long, the payments
// made, and the carts closed in the last 24 hours. From here a manager can
// release selections, remove unpaid items, close the table and merge duplicate
// carts, each after a confirmation that says what will happen. No money moves.
const TableSheet = ({ shopId, tableId, tableName, status, show, handleClose, onChanged }: TableSheetProps) => {
  const [carts, setCarts] = useState<ITableCarts | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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

  // A fresh sheet each time it opens: no leftover confirmation or result.
  useEffect(() => {
    if (!show) {
      setPending(null);
      setResult(null);
    }
  }, [show]);

  const ask: Ask = (action) => {
    setResult(null);
    setPending(action);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const { data } = await pending.send();
      setResult({ variant: "success", text: pending.done(data) });
    } catch (err) {
      // A 409 means the table isn't as it was shown (it's reloaded below): a
      // diner paid or changed something meanwhile, or there's nothing left for
      // this action to do.
      const stale = axios.isAxiosError(err) && err.response?.status === 409;
      const text = errorText(err);
      setResult(
        !stale
          ? { variant: "danger", text }
          : text === CART_CHANGED
            ? {
                variant: "warning",
                text: "The table changed while you were looking: here it is again. Check it before trying again.",
              }
            : { variant: "warning", text: `${text}. Here's the table as it is now.` }
      );
    } finally {
      setBusy(false);
      setPending(null);
      load();
      onChanged?.();
    }
  };

  const cartUrl = (cartId: string, action: string) =>
    `/shops/${shopId}/tables/${tableId}/carts/${cartId}/${action}`;
  const post = (cartId: string, action: string, body: object = {}) => () =>
    backend.post(cartUrl(cartId, action), body);

  const open = carts?.open ?? [];
  const closed = carts?.recentlyClosed ?? [];

  // The confirmation takes focus, so keyboard and screen-reader users land on it.
  const confirmRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);

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
        {result && (
          <Alert variant={result.variant} className="py-2" role="status" dismissible onClose={() => setResult(null)}>
            {result.text}
          </Alert>
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
            <CartDetails cart={cart} ask={ask} post={post} disabled={busy || !!pending} />
            <div className="d-flex flex-wrap gap-2 mt-3">
              {i > 0 && (
                <Button
                  variant="outline-primary"
                  disabled={busy || !!pending}
                  onClick={() =>
                    ask({
                      message:
                        "Move this cart's unpaid items and selections into the newest cart? Its paid items stay on this one as the record.",
                      confirmLabel: "Merge carts",
                      danger: false,
                      send: post(cart._id, "mergeInto"),
                      done: () => "Carts merged.",
                    })
                  }
                >
                  Merge into the newest cart
                </Button>
              )}
              <Button
                variant="outline-danger"
                disabled={busy || !!pending}
                onClick={() => ask(closeAction(cart, tableName, post(cart._id, "close")))}
              >
                Close table
              </Button>
            </div>
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
      {pending && (
        <Modal.Footer className="flex-column align-items-stretch">
          <p ref={confirmRef} tabIndex={-1} className="mb-2 sheet-confirm">
            {pending.message}
          </p>
          <div className="d-flex justify-content-end gap-2">
            <Button variant="outline-secondary" disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button variant={pending.danger ? "danger" : "primary"} disabled={busy} onClick={confirm}>
              {busy ? "Working…" : pending.confirmLabel}
            </Button>
          </div>
        </Modal.Footer>
      )}
    </Modal>
  );
};

// Closing a table: what will be dropped, in words, and what the BE did.
const closeAction = (
  cart: IManagerCart,
  tableName: string,
  send: PendingAction["send"]
): PendingAction => {
  const dropped = cart.items.filter((i) => unpaidOf(i) > 0);
  const neverPaid =
    !cart.items.some((i) => (i.qtyPayed ?? 0) > 0) &&
    !cart.split.some((s) => s.splitStatus === "closed");
  const count = dropped.reduce((sum, i) => sum + unpaidOf(i), 0);
  const what = dropped.map((i) => units(unpaidOf(i), i.menuId?.name)).join(", ");
  return {
    message:
      `Close Table ${tableName}? ` +
      (count > 0
        ? `${count} unpaid ${count === 1 ? "item" : "items"} will be dropped: ${what}. `
        : "Nothing unpaid will be dropped. ") +
      (neverPaid
        ? "Nothing on it was paid, so the cart will be deleted."
        : "Paid items stay on record.") +
      " The next party at this table starts a new cart.",
    confirmLabel: "Close table",
    danger: true,
    send,
    done: (data) => {
      const { deleted } = data as { deleted?: boolean };
      return deleted ? "Table closed and its cart deleted." : "Table closed.";
    },
  };
};

// ---------------------------------------------------------------------------

interface CartDetailsProps {
  cart: IManagerCart;
  ask: Ask;
  post: (cartId: string, action: string, body?: object) => PendingAction["send"];
  disabled: boolean;
}

const CartDetails = ({ cart, ask, post, disabled }: CartDetailsProps) => {
  const selections = cart.split.filter((s) => s.splitStatus === "open");
  const selectedOf = (menuId: string | undefined) =>
    selections
      // The manager endpoint always populates menuId.
      .filter((s) => s.menuId?._id === menuId)
      .reduce((sum, s) => sum + s.qty, 0);

  const release = (s: IManagerSplit) => {
    const who = s.userId?.name ?? "A diner";
    const what = units(s.qty, s.menuId?.name);
    ask({
      message: `Release ${who}'s selection of ${what}? Anyone at the table can then pay for it. ${who} will see a note.`,
      confirmLabel: "Release",
      danger: false,
      send: post(cart._id, "releaseSelection", { userId: s.userId?._id, menuId: s.menuId?._id }),
      done: () => `Released ${who}'s selection of ${what}.`,
    });
  };

  const releaseAll = () =>
    ask({
      message: `Release all ${selections.length} selections on this table? Each diner affected will see a note.`,
      confirmLabel: "Release all",
      danger: false,
      send: post(cart._id, "releaseSelection"),
      done: () => "Released all selections.",
    });

  const remove = (item: IManagerCart["items"][number]) => {
    const unpaid = unpaidOf(item);
    const what = units(unpaid, item.menuId?.name);
    const paid = item.qtyPayed ?? 0;
    ask({
      message:
        `Remove ${what} (unpaid) from the table's cart? Any selections on it are released.` +
        (paid > 0 ? ` The ${paid} paid ${paid === 1 ? "stays" : "stay"} on record.` : "") +
        " The table will see a note.",
      confirmLabel: "Remove",
      danger: true,
      send: post(cart._id, "removeItem", { menuId: menuIdOf(item) }),
      done: () => `Removed ${what}.`,
    });
  };

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
            const unpaid = unpaidOf(item);
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
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <span className="small text-body-secondary">
                    Ordered {item.qty} · Paid {item.qtyPayed ?? 0} · Selected {selectedOf(menuId)}
                  </span>
                  {unpaid > 0 && (
                    <Button variant="outline-danger" disabled={disabled} onClick={() => remove(item)}>
                      Remove {unpaid} unpaid
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
        <h4 className="h6 mb-0">Selected to pay</h4>
        {selections.length > 1 && (
          <Button variant="outline-primary" disabled={disabled} onClick={releaseAll}>
            Release all
          </Button>
        )}
      </div>
      {selections.length === 0 ? (
        <p className="text-body-secondary small mt-2">No one is paying right now.</p>
      ) : (
        <ul className="list-unstyled sheet-list">
          {selections.map((s) => {
            const long = s.claimedAt && Date.now() - new Date(s.claimedAt).getTime() > 15 * 60000;
            return (
              <li key={s._id} className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <span>
                  {s.userId?.name ?? "A diner"}: {units(s.qty, s.menuId?.name)}
                  {s.claimedAt && (
                    <span className={`small ms-2 ${long ? "text-danger-emphasis" : "text-body-secondary"}`}>
                      {long && <FiAlertTriangle aria-hidden className="me-1 align-text-bottom" />}
                      held {heldFor(s.claimedAt)}
                    </span>
                  )}
                </span>
                <Button
                  variant="outline-primary"
                  disabled={disabled}
                  onClick={() => release(s)}
                  aria-label={`Release ${s.userId?.name ?? "a diner"}'s selection of ${units(s.qty, s.menuId?.name)}`}
                >
                  Release
                </Button>
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
                {p.lines.map((l) => units(l.qty, l.name)).join(", ")}
              </div>
            </li>
          ))}
          {legacy.length > 0 && (
            <li>
              <div>Paid, details unavailable</div>
              <div className="small text-body-secondary">
                {legacy.map((s) => units(s.qty, s.menuId?.name)).join(", ")}
              </div>
            </li>
          )}
        </ul>
      )}
    </>
  );
};

export default TableSheet;
