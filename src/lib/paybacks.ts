import type { IDiner, IPayback, PaybackDoneAs } from "../typings/tables";
import { formatPrice } from "./price";
import { capitalised } from "./text";
import { dateTime } from "./tables";

// Pay-backs on the manager's table sheet (UnQ-BE S35): what each owed one asks
// staff to do, what marking it done says, and how a done one reads.

// What it's marked as when done, as the BE accepts it: a dispute first (the
// diner's bank returns the money, whatever else), then one a cart shows as
// paid (check it), else paid back.
export const doneAsFor = (p: IPayback): PaybackDoneAs =>
  p.disputed ? "handled" : p.recorded ? "checked" : "paidBack";

export const DONE_BUTTON: Record<PaybackDoneAs, string> = {
  paidBack: "Mark paid back",
  handled: "Mark handled",
  checked: "Mark checked",
};

const GONE = "a diner whose account is gone";
const dinerName = (diner: IDiner | null) => diner?.name ?? GONE;
// " (payment pi_…)", the id staff look it up by in Stripe's dashboard.
const paymentRef = (p: IPayback) => (p.paymentIntentId ? ` (payment ${p.paymentIntentId})` : "");

// What staff must do about an owed one.
export const owedText = (p: IPayback) => {
  const who = dinerName(p.userId);
  const amount = formatPrice(p.amount);
  if (p.disputed && p.kind === "refundFailed") {
    const whole = formatPrice(p.paymentAmount ?? p.amount);
    return (
      `A ${amount} refund to ${who} couldn't be made: they dispute the whole ${whole} payment with their bank${paymentRef(p)}. ` +
      `Don't pay the ${amount} back yourselves: if you accept the dispute, their bank returns all ${whole}; ` +
      `if you contest it and win, pay the ${amount} back another way.`
    );
  }
  if (p.disputed) {
    return (
      `${capitalised(who)} disputes ${amount} with their bank${paymentRef(p)}: don't pay them back yourselves. ` +
      "Accept the dispute in Stripe's dashboard (don't contest it), and their bank returns it. " +
      "If it closes without the money going back to them, pay them back another way." +
      (p.recorded ? " A cart shows it as paid." : "")
    );
  }
  if (p.recorded) {
    return (
      `Stripe won't refund ${amount} to ${who}${paymentRef(p)}, but a cart shows it as paid: check that payment on this sheet first ` +
      "(did they pay again? was it refunded since?), and that Stripe's dashboard shows no dispute since."
    );
  }
  if (p.kind === "refundFailed") {
    return `${amount} refund to ${who} failed at Stripe: pay them back another way, unless Stripe's dashboard shows they've disputed it since.`;
  }
  return (
    `Pay back ${amount} to ${who}${paymentRef(p)}: Stripe won't refund it. Not if a cart shows it as paid and they didn't pay again, ` +
    "or Stripe's dashboard shows they've disputed it since (their bank returns it then)."
  );
};

// The question before marking it done.
export const markQuestion = (p: IPayback) => {
  const who = dinerName(p.userId);
  const amount = formatPrice(p.amount);
  switch (doneAsFor(p)) {
    case "handled":
      return `Mark the dispute of ${amount} with ${who} as handled? Do this once you've dealt with it in Stripe's dashboard.`;
    case "checked":
      return `Mark the ${amount} shown as paid for ${who} as checked? Do this once you've checked that payment on this sheet and in Stripe's dashboard.`;
    case "paidBack":
      return `Mark the ${amount} pay-back to ${who} as paid back? Do this once you've paid them back another way.`;
  }
};

const DONE_WORDS: Record<PaybackDoneAs, string> = {
  paidBack: "paid back",
  handled: "handled",
  checked: "checked",
};
// What marking it stored: as the BE answers, which is how another manager
// marked it when they did first.
export const markedText = (doneAs: PaybackDoneAs | undefined) => `Marked ${DONE_WORDS[doneAs ?? "paidBack"]}.`;

// A done one: what was done, by whom and when.
export const doneText = (p: IPayback, now = new Date()) => {
  const who = dinerName(p.userId);
  const amount = formatPrice(p.amount);
  const what =
    p.doneAs === "handled"
      ? `Dispute of ${amount} handled for ${who}`
      : p.doneAs === "checked"
        ? `Checked ${amount} shown as paid for ${who}`
        : `Paid back ${amount} to ${who}`;
  const by = p.doneByUserId?.name ?? "a manager";
  return `${what} · marked by ${by}${p.doneAt ? `, ${dateTime(p.doneAt, now)}` : ""}`;
};
