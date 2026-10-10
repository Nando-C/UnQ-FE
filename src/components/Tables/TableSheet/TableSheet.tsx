import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import { FiAlertTriangle } from "react-icons/fi";
import { ConfirmFooter } from "../../Common/ConfirmFooter";
import backend from "../../../backend/backend";
import { useVisiblePolling } from "../../../lib/useVisiblePolling";
import { formatPrice, fromPence, toPence } from "../../../lib/price";
import { apiErrorBody, apiErrorMessage, apiStatus } from "../../../lib/errors";
import { menuIdOf, unpaidQty } from "../../../lib/cart";
import { STALE_SELECTION_MS, STATE_CLASS, STATE_LABEL, clockTime, heldFor, logActionLabel, needsStaffLine } from "../../../lib/tables";
import { REFUND_NOTE_MAX, REFUND_REASON_LABEL, REFUND_REASONS, refundReasonText } from "../../../lib/refundReasons";
import { providerName, refundDestination } from "../../../lib/providers";
import { DONE_BUTTON, doneAsFor, doneText, markQuestion, markedText, owedText } from "../../../lib/paybacks";
import { IManagerCart, IManagerLogEntry, IManagerSplit, IPayback, IPayment, IRefund, ITableCarts, ITableStatus, PaybackDoneAs, RefundReason } from "../../../typings/tables";
import "./TableSheet.css";

// How often an open sheet refreshes (the table cards refresh every 30 s).
const REFRESH_MS = 20_000;
// The BE's 409s that mean "what you saw has changed", said in the sheet's own
// words (the sheet is reloaded after every action): the cart changed between
// loading and saving, or a pay-back is no longer as it was shown.
const CHANGED_TEXT = new Map([
  ["The cart changed, please retry", "The table changed while you were looking: here it is again. Check it before trying again."],
  ["This pay-back changed: here it is again", "This pay-back changed while you were looking: here it is again. Check it before trying again."],
]);

interface TableSheetProps {
  shopId: string;
  tableId: string;
  tableName: string;
  status?: ITableStatus;
  show: boolean;
  handleClose: () => void;
  // After an action changed the table, so the card can refresh its status.
  onChanged?: () => void;
  // A deleted table: it takes no orders, only its last carts are shown.
  deleted?: boolean;
}

// A manager action waiting for confirmation. `message` says in plain words
// what will happen; `done` turns the BE's answer into what did.
interface PendingAction {
  message: string;
  confirmLabel: string;
  danger: boolean;
  send: () => Promise<{ data: unknown }>;
  done: (data: unknown) => string;
  // Once it has been sent, whatever came of it (not when it's cancelled):
  // with the error when it failed.
  onSent?: (failure?: unknown) => void;
}
type Ask = (action: PendingAction) => void;

interface Result {
  variant: "success" | "warning" | "danger";
  text: string;
}

// "2× Latte"
const units = (qty: number, name: string | undefined) => `${qty}× ${name ?? "item"}`;

// One table as the manager sees it: what's in its open cart (ordered, paid and
// selected per item), who has selected what and for how long, the payments
// made, and the carts closed in the last 24 hours. From here a manager can
// release selections, remove unpaid items, close the table and merge duplicate
// carts, refund payments and check payments their provider hadn't confirmed, each after
// a confirmation that says what will happen.
const TableSheet = ({ shopId, tableId, tableName, status, show, handleClose, onChanged, deleted }: TableSheetProps) => {
  const [carts, setCarts] = useState<ITableCarts | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  // Nothing else can be asked while an action is being confirmed or sent.
  const locked = busy || !!pending;
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

  // The control that asked, taken as it asks: once the question shows, every
  // action is disabled and the browser moves focus off it. Focus goes back to
  // it when the question closes.
  const askedFrom = useRef<HTMLElement | null>(null);
  const ask: Ask = (action) => {
    askedFrom.current = document.activeElement as HTMLElement | null;
    setResult(null);
    setPending(action);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    let failure: unknown;
    try {
      const { data } = await pending.send();
      setResult({ variant: "success", text: pending.done(data) });
    } catch (err) {
      failure = err;
      // A 409 means the table isn't as it was shown (it's reloaded below): a
      // diner paid or changed something meanwhile, or there's nothing left for
      // this action to do.
      const stale = apiStatus(err) === 409;
      const text = apiErrorMessage(err);
      const changed = stale ? CHANGED_TEXT.get(apiErrorBody(err).message ?? "") : undefined;
      setResult(
        !stale
          ? { variant: "danger", text }
          : { variant: "warning", text: changed ?? `${text}. Here's the table as it is now.` }
      );
    } finally {
      setBusy(false);
      setPending(null);
      pending.onSent?.(failure);
      load();
      onChanged?.();
    }
  };

  const cartUrl = (cartId: string, action: string) =>
    `/shops/${shopId}/tables/${tableId}/carts/${cartId}/${action}`;
  const post = (cartId: string, action: string, body: object = {}) => () =>
    backend.post(cartUrl(cartId, action), body);
  const sendRefund: SendRefund = (cartId, body) => () =>
    backend.post(`/shops/${shopId}/carts/${cartId}/refunds`, body);
  const retryRefund: RetryRefund = (cartId, refundId) => () =>
    backend.post(`/shops/${shopId}/carts/${cartId}/refunds/${refundId}/retry`);
  const checkPayment: CheckPayment = (cartId, paymentId) => () =>
    backend.post(`/shops/${shopId}/carts/${cartId}/payments/${paymentId}/check`);
  const markDone: MarkDone = (paybackId, as) => () =>
    backend.post(`/shops/${shopId}/paybacks/${paybackId}/done`, { as });

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
        <Paybacks paybacks={carts?.paybacks ?? []} ask={ask} markDone={markDone} disabled={locked} />
        {carts && open.length === 0 && (
          <p className="text-body-secondary">
            {deleted ? "This table was deleted: it takes no more orders." : "No open cart: this table is free."}
          </p>
        )}
        {open.map((cart, i) => (
          <section key={cart._id} className="mb-4">
            {open.length > 1 && (
              <h3 className="h6">
                Open cart {i + 1} of {open.length}
                {i === 0 ? " (the one diners see)" : " (not shown to diners)"}
              </h3>
            )}
            <CartDetails cart={cart} ask={ask} post={post} sendRefund={sendRefund} retryRefund={retryRefund} checkPayment={checkPayment} disabled={locked} />
            <CartLog cart={cart} />
            <div className="d-flex flex-wrap gap-2 mt-3">
              {i > 0 && (
                <Button
                  variant="outline-primary"
                  disabled={locked}
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
                disabled={locked}
                onClick={() => ask(closeAction(cart, tableName, post(cart._id, "close")))}
              >
                Close table
              </Button>
            </div>
          </section>
        ))}
        {closed.length > 0 && (
          <details className="mt-3">
            <summary>
              Closed in the last 24 hours ({closed.length})
              {closed.some(needsStaff) && (
                <span className="text-danger-emphasis ms-2">
                  <FiAlertTriangle aria-hidden className="me-1 align-text-bottom" />
                  Needs staff
                </span>
              )}
            </summary>
            {closed.map((cart) => (
              <section key={cart._id} className="mt-3">
                <h3 className="h6">
                  Closed {cart.updatedAt ? clockTime(cart.updatedAt) : ""}
                </h3>
                <Payments cart={cart} ask={ask} sendRefund={sendRefund} retryRefund={retryRefund} checkPayment={checkPayment} disabled={locked} />
                <CartLog cart={cart} />
              </section>
            ))}
          </details>
        )}
      </Modal.Body>
      {/* The confirmation takes focus, so keyboard and screen-reader users
          land on it. Keyed on its question, so a different one is focused
          afresh (the sheet's other actions are off while one is open). */}
      {pending && (
        <ConfirmFooter
          key={pending.message}
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          danger={pending.danger}
          busy={busy}
          onConfirm={confirm}
          onCancel={() => setPending(null)}
          returnFocus={() => askedFrom.current}
        />
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------------------

type MarkDone = (paybackId: string, as: PaybackDoneAs) => PendingAction["send"];

// The table's pay-backs, first on the sheet (they belong to the table, not to
// a cart, which may be gone): what's owed and what to do about each, with the
// button that marks it done, then the ones marked done in the last 30 days.
const Paybacks = ({
  paybacks,
  ask,
  markDone,
  disabled,
}: {
  paybacks: IPayback[];
  ask: Ask;
  markDone: MarkDone;
  disabled: boolean;
}) => {
  const headingId = useId();
  if (paybacks.length === 0) return null;
  const owed = paybacks.filter((p) => p.owed);
  const done = paybacks.filter((p) => !p.owed);
  return (
    <section className="mb-4" aria-labelledby={headingId}>
      <h3 id={headingId} className="h6">
        To pay back
      </h3>
      {owed.length === 0 ? (
        <p className="text-body-secondary small mb-2">Nothing owed now.</p>
      ) : (
        <ul className="list-unstyled sheet-list" aria-label="Owed">
          {owed.map((p) => {
            const as = doneAsFor(p);
            return (
              <li key={p._id}>
                <p className="mb-2 text-danger-emphasis">
                  <FiAlertTriangle aria-hidden className="me-1 align-text-bottom" />
                  {owedText(p)}
                </p>
                <Button
                  variant="outline-primary"
                  disabled={disabled}
                  onClick={() =>
                    ask({
                      message: markQuestion(p),
                      confirmLabel: DONE_BUTTON[as],
                      danger: false,
                      send: markDone(p._id, as),
                      done: (data) => markedText((data as { payback?: IPayback }).payback?.doneAs),
                    })
                  }
                >
                  {DONE_BUTTON[as]}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {done.length > 0 && (
        <ul className="list-unstyled sheet-list small text-body-secondary" aria-label="Done in the last 30 days">
          {done.map((p) => (
            <li key={p._id}>{doneText(p)}</li>
          ))}
        </ul>
      )}
    </section>
  );
};

// The cart's log, newest first: what managers did, and what the server did
// about card payments. A line staff must act on (a card refund Stripe won't
// make: pay the diner back another way, or, for a dispute, accept it) is
// marked, and flags the closed carts it's under.
const needsStaff = (cart: IManagerCart) => (cart.managerLog ?? []).some(needsStaffLine);

// Who wrote a line: a manager, or UnQ itself (no one).
const authorOf = (line: IManagerLogEntry) =>
  line.byUserId === undefined ? "UnQ" : (line.byUserId?.name ?? "A manager");

const CartLog = ({ cart }: { cart: IManagerCart }) => {
  const lines = [...(cart.managerLog ?? [])].reverse();
  if (lines.length === 0) return null;
  return (
    <>
      <h4 className="h6 mt-3">Log</h4>
      <ul className="list-unstyled sheet-list small">
        {lines.map((line, i) => {
          const staff = needsStaffLine(line);
          return (
            <li key={`${line.at}-${line.action}-${i}`} className={staff ? "text-danger-emphasis" : undefined}>
              <div className="text-body-secondary">
                {clockTime(line.at)} · {authorOf(line)}
              </div>
              <div>
                {staff && <FiAlertTriangle aria-hidden className="me-1 align-text-bottom" />}
                {logActionLabel(line.action)}: {line.details}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
};

// Closing a table: what will be dropped, in words, and what the BE did.
const closeAction = (
  cart: IManagerCart,
  tableName: string,
  send: PendingAction["send"]
): PendingAction => {
  const dropped = cart.items.filter((i) => unpaidQty(i) > 0);
  // As the BE decides: a payment record (even one refunded) keeps the cart.
  const neverPaid =
    !cart.items.some((i) => (i.qtyPayed ?? 0) > 0) &&
    !cart.split.some((s) => s.splitStatus === "closed") &&
    !cart.payments?.length;
  const count = dropped.reduce((sum, i) => sum + unpaidQty(i), 0);
  const what = dropped.map((i) => units(unpaidQty(i), i.menuId?.name)).join(", ");
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

// What the refund picker asks for: units of each item, and why.
interface RefundRequest {
  lines: { menuId: string; qty: number }[];
  reason: RefundReason;
  // Only with "other".
  reasonNote?: string;
}
type SendRefund = (cartId: string, body: RefundRequest & { paymentId: string }) => PendingAction["send"];
// The BE's 400 messages for the reason fields, shown under them.
type ReasonErrors = Partial<Record<"reason" | "reasonNote", string>>;

const reasonErrorsOf = (err: unknown): ReasonErrors | null => {
  if (apiStatus(err) !== 400) return null;
  const errors: ReasonErrors = {};
  for (const d of apiErrorBody(err).details ?? []) {
    if (d.path === "reason" || d.path === "reasonNote") errors[d.path] ??= d.message;
  }
  return Object.keys(errors).length > 0 ? errors : null;
};
type RetryRefund = (cartId: string, refundId: string) => PendingAction["send"];
type CheckPayment = (cartId: string, paymentId: string) => PendingAction["send"];

interface CartDetailsProps {
  cart: IManagerCart;
  ask: Ask;
  post: (cartId: string, action: string, body?: object) => PendingAction["send"];
  sendRefund: SendRefund;
  retryRefund: RetryRefund;
  checkPayment: CheckPayment;
  disabled: boolean;
}

const CartDetails = ({ cart, ask, post, sendRefund, retryRefund, checkPayment, disabled }: CartDetailsProps) => {
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
      // null for a diner whose account is gone: the BE then releases only
      // those. Left out, it would release everyone's selection of the item.
      send: post(cart._id, "releaseSelection", { userId: s.userId?._id ?? null, menuId: s.menuId?._id }),
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
    const unpaid = unpaidQty(item);
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
            const unpaid = unpaidQty(item);
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
            const long = s.claimedAt && Date.now() - new Date(s.claimedAt).getTime() > STALE_SELECTION_MS;
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

      <Payments cart={cart} ask={ask} sendRefund={sendRefund} retryRefund={retryRefund} checkPayment={checkPayment} disabled={disabled} />
    </>
  );
};

// Payments on a cart: the recorded ones in full, each with what's been refunded
// and a way to refund more, and any paid units from before payments were
// recorded as one "details unavailable" line (refunded from PayPal, the only
// provider then). One its provider hasn't confirmed can only be checked; one
// that failed, only seen.
interface PaymentsProps {
  cart: IManagerCart;
  ask: Ask;
  sendRefund: SendRefund;
  retryRefund: RetryRefund;
  checkPayment: CheckPayment;
  disabled: boolean;
}

// A payment's refunds as the sheet shows them, and whether another can be
// started from here: a completed payment (none from before payments had a
// status) with its capture id, something left, and no refund of it under way.
const refundStateOf = (p: IPayment, refunds: IRefund[]) => {
  const mine = refunds.filter((r) => r.paymentId === p._id);
  const underWay = mine.filter((r) => r.status === "pending");
  // Per line, what can still be refunded: paid, less refunded, less refunds
  // under way.
  const leftOf = (line: IPayment["lines"][number]) =>
    line.qty -
    line.refundedQty -
    underWay
      .flatMap((r) => r.lines)
      .filter((l) => l.menuId === line.menuId)
      .reduce((sum, l) => sum + l.qty, 0);
  const canRefund =
    p.status !== "pending" &&
    p.status !== "failed" &&
    !!p.providerPaymentId &&
    underWay.length === 0 &&
    p.lines.some((l) => leftOf(l) > 0);
  return { refunded: mine.filter((r) => r.status === "completed"), underWay, leftOf, canRefund };
};

const Payments = ({ cart, ask, sendRefund, retryRefund, checkPayment, disabled }: PaymentsProps) => {
  const payments = cart.payments ?? [];
  const refunds = cart.refunds ?? [];
  const legacy = cart.split.filter((s) => s.splitStatus === "closed" && s.unitPrice === undefined);
  const [refunding, setRefunding] = useState<string | null>(null);
  // The picker closes once its payment can't be refunded (another refund under
  // way, nothing left), not while locked: its question keeps its picks, and
  // the BE still refuses more than is left.
  const picking = payments.find((p) => p._id === refunding);
  if (refunding !== null && !disabled && !(picking && refundStateOf(picking, refunds).canRefund)) setRefunding(null);

  return (
    <>
      <h4 className="h6 mt-3">Payments</h4>
      {payments.length === 0 && legacy.length === 0 ? (
        <p className="text-body-secondary small">No payments yet.</p>
      ) : (
        <ul className="list-unstyled sheet-list">
          {payments.map((p) => {
            const { refunded, underWay, leftOf, canRefund } = refundStateOf(p, refunds);
            const who = p.userId?.name ?? "the diner";
            const provider = providerName(p.provider);
            return (
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
                {p.status === "pending" && (
                  <div className="small text-danger-emphasis">
                    <FiAlertTriangle aria-hidden className="me-1 align-text-bottom" />
                    Awaiting {provider}: it took this payment but hasn't confirmed it. The items are held as paid until then.
                    <Button
                      variant="outline-primary"
                      className="d-block mt-2"
                      disabled={disabled}
                      aria-label={`Check ${who}'s payment of ${formatPrice(p.amount)} with ${provider}`}
                      onClick={() =>
                        ask({
                          message:
                            `Check ${who}'s payment of ${formatPrice(p.amount)} with ${provider}? If ${provider} confirmed it, it's ` +
                            `recorded as paid. If ${provider} declined it, nothing was taken and its items become unpaid again. ` +
                            `${who} will see a note either way.`,
                          confirmLabel: "Check payment",
                          danger: false,
                          send: checkPayment(cart._id, p._id),
                          done: (data) =>
                            (data as { payment?: { status?: string } }).payment?.status === "failed"
                              ? `${provider} didn't complete ${who}'s payment of ${formatPrice(p.amount)}: nothing was taken, and those items are unpaid again.`
                              : `${provider} confirmed ${who}'s payment of ${formatPrice(p.amount)}.`,
                        })
                      }
                    >
                      Check payment
                    </Button>
                  </div>
                )}
                {p.status === "failed" && (
                  <div className="small text-body-secondary">Didn't go through at {provider}: nothing was taken.</div>
                )}
                {refunded.map((r) => {
                  const why = refundReasonText(r.reason, r.reasonNote);
                  return (
                    <div key={r._id} className="small">
                      Refunded <strong className="text-nowrap">{formatPrice(r.amount)}</strong>
                      {why && ` · ${why}`}
                    </div>
                  );
                })}
                {refunded.length > 1 && (
                  <div className="small">
                    Refunded in all{" "}
                    <strong className="text-nowrap">
                      {formatPrice(refunded.reduce((sum, r) => sum + r.amount, 0))}
                    </strong>
                  </div>
                )}
                {underWay.map((r) => {
                  const what = r.lines.map((l) => units(l.qty, l.name)).join(", ");
                  const why = refundReasonText(r.reason, r.reasonNote);
                  return (
                    <div key={r._id} className="small text-danger-emphasis">
                      <FiAlertTriangle aria-hidden className="me-1 align-text-bottom" />
                      Refund of {formatPrice(r.amount)} in progress: {provider} hasn't confirmed it.
                      {why && ` Reason: ${why}.`}
                      <Button
                        variant="outline-primary"
                        className="d-block mt-2"
                        disabled={disabled}
                        aria-label={`Retry the ${formatPrice(r.amount)} refund to ${who}`}
                        onClick={() =>
                          ask({
                            message:
                              `Retry the ${formatPrice(r.amount)} refund to ${who} for ${what}? ${provider} is asked first ` +
                              `whether it already went through; it's only sent again if it didn't, so it can't be refunded twice.`,
                            confirmLabel: "Retry refund",
                            danger: false,
                            send: retryRefund(cart._id, r._id),
                            done: () => `Refunded ${formatPrice(r.amount)} to ${who}.`,
                          })
                        }
                      >
                        Retry refund
                      </Button>
                    </div>
                  );
                })}
                {p.status === "pending" || p.status === "failed" ? null : !p.providerPaymentId ? (
                  <div className="small text-body-secondary">Refund this payment from {provider}.</div>
                ) : refunding === p._id ? (
                  // Stays open (locked) while the refund is asked about, so Cancel
                  // comes back to the picks as they were, and to Review refund.
                  <RefundPicker
                    payment={p}
                    leftOf={leftOf}
                    disabled={disabled}
                    onCancel={() => setRefunding(null)}
                    onReview={(refund, amount, showErrors) => {
                      const what = refund.lines
                        .map((l) => units(l.qty, p.lines.find((pl) => pl.menuId === l.menuId)?.name))
                        .join(", ");
                      ask({
                        message:
                          `Refund ${formatPrice(amount)} to ${who} for ${what}? ` +
                          `Reason: ${refundReasonText(refund.reason, refund.reasonNote)}. ${provider} returns it to their ` +
                          `${refundDestination(p.provider)}, ` +
                          `the items are removed from the table's cart, and ${who} will see a note. This can't be undone.`,
                        confirmLabel: `Refund ${formatPrice(amount)} to ${who}`,
                        danger: true,
                        send: sendRefund(cart._id, { paymentId: p._id, ...refund }),
                        done: () => `Refunded ${formatPrice(amount)} to ${who}.`,
                        // A reason the BE refused leaves the picker open, with
                        // its message under the field; anything else closes it.
                        onSent: (failure) => {
                          const errors = reasonErrorsOf(failure);
                          if (errors) showErrors(errors);
                          else setRefunding(null);
                        },
                      });
                    }}
                  />
                ) : (
                  canRefund && (
                    <Button
                      variant="outline-danger"
                      className="mt-2"
                      disabled={disabled}
                      onClick={() => setRefunding(p._id)}
                      aria-label={`Refund items from ${p.userId?.name ?? "a diner"}'s payment of ${formatPrice(p.amount)}`}
                    >
                      Refund…
                    </Button>
                  )
                )}
              </li>
            );
          })}
          {legacy.length > 0 && (
            <li>
              <div>Paid, details unavailable</div>
              <div className="small text-body-secondary">
                {legacy.map((s) => units(s.qty, s.menuId?.name)).join(", ")}
              </div>
              <div className="small text-body-secondary">Refund these from PayPal.</div>
            </li>
          )}
        </ul>
      )}
    </>
  );
};

// Step 1 of a refund: how many of each item, up to what's left, with the total
// at the prices paid, and why (Other with a note). Step 2 is the confirmation
// in the sheet's footer.
interface RefundPickerProps {
  payment: IPayment;
  leftOf: (line: IPayment["lines"][number]) => number;
  // While any action in the sheet is being confirmed or sent.
  disabled: boolean;
  onCancel: () => void;
  // `showErrors` puts the BE's messages for the reason fields under them.
  onReview: (refund: RefundRequest, amount: number, showErrors: (errors: ReasonErrors) => void) => void;
}

const RefundPicker = ({ payment, leftOf, disabled, onCancel, onReview }: RefundPickerProps) => {
  const [picks, setPicks] = useState<Record<string, number>>({});
  // The BE's messages for the reason fields, until either is changed.
  const [errors, setErrors] = useState<ReasonErrors | null>(null);
  // Picks capped at what's left (the payment can change under an open
  // picker), except while locked: then as the question asks about them.
  const qtyOf = (l: IPayment["lines"][number]) =>
    disabled ? (picks[l.menuId] ?? 0) : Math.min(picks[l.menuId] ?? 0, leftOf(l));
  const [reason, setReason] = useState<RefundReason | "">("");
  // Kept while another reason is chosen, but only sent with Other.
  const [note, setNote] = useState("");
  const id = useId();
  const lines = payment.lines.filter((l) => leftOf(l) > 0 || (disabled && (picks[l.menuId] ?? 0) > 0));
  const amount = fromPence(toPence(lines.reduce((sum, l) => sum + qtyOf(l) * l.unitPrice, 0)));
  const set = (menuId: string, qty: number) => setPicks((p) => ({ ...p, [menuId]: qty }));
  const other = reason === "other";
  // As the BE takes it: trimmed, at least one character.
  const trimmedNote = note.trim();
  // What Review refund asks about, once there's something to refund and a
  // reason (with a note for Other).
  const request: RefundRequest | null =
    amount > 0 && reason !== "" && (!other || trimmedNote !== "")
      ? {
          lines: lines
            .filter((l) => qtyOf(l) > 0)
            .map((l) => ({ menuId: l.menuId, qty: qtyOf(l) })),
          reason,
          ...(other && { reasonNote: trimmedNote }),
        }
      : null;
  const describedBy = (field: keyof ReasonErrors, ...more: string[]) =>
    [...(errors?.[field] ? [`${id}-${field}-error`] : []), ...more].join(" ") || undefined;

  return (
    <div className="refund-picker mt-2 p-2 rounded border" role="group" aria-label="Choose what to refund">
      {lines.map((l) => {
        const qty = qtyOf(l);
        const left = leftOf(l);
        return (
          <div key={l.menuId} className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-1">
            <span>
              {l.name} <span className="small text-body-secondary text-nowrap">{formatPrice(l.unitPrice)} each · {left} left</span>
            </span>
            <div className="stepper" role="group" aria-label={`${l.name} to refund`}>
              <Button
                variant="link"
                className="hit-44"
                disabled={disabled || qty <= 0}
                onClick={() => set(l.menuId, qty - 1)}
                aria-label={`Refund one fewer ${l.name}`}
              >
                −
              </Button>
              <span className="qty">{qty}</span>
              <Button
                variant="link"
                className="hit-44"
                disabled={disabled || qty >= left}
                onClick={() => set(l.menuId, qty + 1)}
                aria-label={`Refund one more ${l.name}`}
              >
                +
              </Button>
            </div>
          </div>
        );
      })}
      <Form.Group controlId={`${id}-reason`} className="mt-2">
        <Form.Label className="mb-1">Reason</Form.Label>
        <Form.Select
          required
          value={reason}
          disabled={disabled}
          isInvalid={!!errors?.reason}
          aria-invalid={!!errors?.reason || undefined}
          aria-describedby={describedBy("reason")}
          onChange={(e) => {
            setReason(e.currentTarget.value as RefundReason);
            setErrors(null);
          }}
        >
          <option value="" disabled>
            Choose a reason…
          </option>
          {REFUND_REASONS.map((r) => (
            <option key={r} value={r}>
              {REFUND_REASON_LABEL[r]}
            </option>
          ))}
        </Form.Select>
        <Form.Control.Feedback type="invalid" id={`${id}-reason-error`}>
          {errors?.reason}
        </Form.Control.Feedback>
      </Form.Group>
      {other && (
        <Form.Group controlId={`${id}-note`} className="mt-2">
          <Form.Label className="mb-1">What happened?</Form.Label>
          <Form.Control
            as="textarea"
            rows={2}
            required
            maxLength={REFUND_NOTE_MAX}
            value={note}
            disabled={disabled}
            isInvalid={!!errors?.reasonNote}
            aria-invalid={!!errors?.reasonNote || undefined}
            aria-describedby={describedBy("reasonNote", `${id}-count`)}
            onChange={(e) => {
              setNote(e.currentTarget.value);
              setErrors(null);
            }}
          />
          <Form.Control.Feedback type="invalid" id={`${id}-reasonNote-error`}>
            {errors?.reasonNote}
          </Form.Control.Feedback>
          <Form.Text id={`${id}-count`} className="d-block text-end">
            {note.length} of {REFUND_NOTE_MAX} characters
          </Form.Text>
        </Form.Group>
      )}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
        <span>
          Refund <strong className="text-nowrap">{formatPrice(amount)}</strong>
        </span>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" disabled={disabled} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={disabled || !request}
            onClick={() => request && onReview(request, amount, setErrors)}
          >
            Review refund
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TableSheet;
