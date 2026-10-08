import { IManagerLogEntry, ManagerLogAction, TableAttention, TableState } from "../typings/tables";

// Words and colours for a table's state on the manager's table cards and sheet.
// The colours are Bootstrap's subtle/emphasis pairs (AA contrast); the words
// carry the meaning, so nothing depends on colour alone.
export const STATE_LABEL: Record<TableState, string> = {
  free: "Free",
  ordering: "Ordering",
  waitingToPay: "Waiting to pay",
  partlyPaid: "Partly paid",
};

export const STATE_CLASS: Record<TableState, string> = {
  free: "bg-body-secondary text-body-emphasis",
  ordering: "bg-info-subtle text-info-emphasis",
  waitingToPay: "bg-warning-subtle text-warning-emphasis",
  partlyPaid: "bg-primary-subtle text-primary-emphasis",
};

export const ATTENTION_LABEL: Record<TableAttention, string> = {
  soldOut: "Sold-out item in the cart",
  staleSelection: "Selection held over 15 min",
  duplicateCarts: "More than one open cart",
  paymentPending: "Payment awaiting confirmation",
  payBack: "Diner to pay back",
};

// What a line in a cart's log says was done (the manager's sheet).
export const LOG_ACTION_LABEL: Record<ManagerLogAction, string> = {
  releaseSelection: "Released selections",
  removeItem: "Removed items",
  close: "Closed the table",
  mergeInto: "Merged carts",
  refund: "Refunded",
  checkPayment: "Checked a payment",
  paybackDone: "Pay-back done",
  stripeRefundFailed: "Action needed",
  stripeRefundedRecorded: "Refunded by Stripe",
  stripeFinished: "Card payment finished",
};
export const logActionLabel = (action: IManagerLogEntry["action"]) => LOG_ACTION_LABEL[action as ManagerLogAction] ?? action;
// A line staff must act on: a card refund Stripe won't make (pay the diner
// back another way, or, for a dispute, accept it).
export const needsStaffLine = (line: IManagerLogEntry) => line.action === "stripeRefundFailed";

// "just now", "12 min", "2 h 5 min": how long ago `iso` was.
export const heldFor = (iso: string, now = Date.now()) => {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
};

// "14:32", or "3 Oct 14:32" when it wasn't today: for what's kept longer than
// a week, where a weekday would be ambiguous.
export const dateTime = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === now.toDateString()
    ? time
    : `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
};

// "14:32", or "Mon 14:32" when it wasn't today.
export const clockTime = (iso: string, now = new Date()) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === now.toDateString()
    ? time
    : `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${time}`;
};
