import { capitalised } from "./text";
import type { RefundReason } from "../typings/tables";

// Why a manager refunds, as the refund picker offers them (in this order) and
// as the table sheet and sales reports show them.
export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  unavailable: "Item unavailable or sold out",
  wrong_item: "Wrong item served",
  quality: "Quality issue",
  long_wait: "Long wait",
  paid_by_mistake: "Paid by mistake or twice",
  changed_mind: "Customer changed their mind",
  other: "Other",
};

export const REFUND_REASONS = Object.keys(REFUND_REASON_LABEL) as RefundReason[];

// The longest note "Other" takes (the BE's limit).
export const REFUND_NOTE_MAX = 200;

// A refund's reason in words: Other with its note. A reason newer than this
// list is spelled out from its code ("late_delivery": "Late delivery"); none
// (an older refund) shows nothing.
export const refundReasonText = (reason?: string, note?: string): string | undefined => {
  if (!reason) return undefined;
  if (reason === "other" && note) return `Other (“${note}”)`;
  if (Object.hasOwn(REFUND_REASON_LABEL, reason)) return REFUND_REASON_LABEL[reason as RefundReason];
  return capitalised(reason.replaceAll("_", " "));
};
