import { formatPrice } from "./price";
import { refundReasonText } from "./refundReasons";
import {
  MetricKey,
  changeOf,
  daysBetween,
  formatAxis,
  formatCount,
  formatPercent,
  hourSpan,
  metric,
  metricOf,
  shareOf,
  weekdayCounts,
  weekdayName,
} from "./sales";
import type { ISalesReport } from "../typings/sales";

// What the figures say, in sentences: rules over the report's own answer, each
// silent when it has nothing worth saying (too few days, diners or refunds to
// draw on, or no movement). Deterministic, so a reader can check every one
// against the chart it points at. At most six are shown, in this order.

export interface Finding {
  id: string;
  text: string;
  // The chart the sentence came from.
  section: "trend" | "when" | "menu" | "refunds" | "diners" | "tables";
  // The metric a mover is about, for a reader already showing its change.
  metric?: MetricKey;
}

const MAX_FINDINGS = 6;
// A change smaller than this against the period before is not a mover.
const MOVER_FROM = 0.1;
// A dish taking this share of revenue is named on its own.
const TOP_ITEM_FROM = 0.2;
// Refunds, diners and tables below these counts say nothing.
const REFUNDS_FROM = 3;
const DINERS_FROM = 10;
// An hour with this share of the refunds is where they cluster.
const CLUSTER_FROM = 0.4;

const percent = (share: number) => formatAxis("percent", share);

// The biggest mover against the period before among the headline metrics.
const mover = ({ totals, previous }: ISalesReport): Finding | null => {
  if (!previous) return null;
  const keys: MetricKey[] = ["net", "orders", "avgOrder", "diners"];
  let best: { key: MetricKey; ratio: number } | null = null;
  for (const key of keys) {
    const before = metricOf(key, previous.totals);
    if (before <= 0) continue;
    const ratio = (metricOf(key, totals) - before) / before;
    if (Math.abs(ratio) >= MOVER_FROM && (!best || Math.abs(ratio) > Math.abs(best.ratio))) best = { key, ratio };
  }
  if (!best) return null;
  const m = metric(best.key);
  const change = changeOf(metricOf(best.key, totals), metricOf(best.key, previous.totals), m.kind);
  if (!change || change.direction === "same") return null;
  // Plural metrics (sales, orders, diners) "are"; an average "is".
  const verb = m.key === "avgOrder" || m.key === "avgVisit" ? "is" : "are";
  return { id: "mover", section: "trend", metric: m.key, text: `${m.label} ${verb} ${change.direction} ${change.text} on the period before.` };
};

// The weekday that brings the most sales, and the busiest hour, from a week.
// A range that isn't whole weeks has one more of some weekdays than others,
// so each weekday is taken as its average day and the share is of a typical
// week.
const busiest = ({ range, heatmap }: ISalesReport): Finding | null => {
  if (daysBetween(range.from, range.to) < 7 || heatmap.length === 0) return null;
  const counts = weekdayCounts(range);
  const byDay = new Map<number, number>();
  const byHour = new Map<number, number>();
  for (const cell of heatmap) {
    byDay.set(cell.dow, (byDay.get(cell.dow) ?? 0) + cell.gross / (counts.get(cell.dow) || 1));
    byHour.set(cell.hour, (byHour.get(cell.hour) ?? 0) + cell.orders);
  }
  const week = [...byDay.values()].reduce((sum, v) => sum + v, 0);
  if (!week) return null;
  const [dow, average] = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
  const [hour] = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    id: "busiest",
    section: "when",
    text: `${weekdayName(dow)} brings ${percent(shareOf(average, week))} of a typical week's sales; the busiest hour is ${hourSpan(hour)}.`,
  };
};

// One dish carrying a fifth of revenue or more, or how few dishes make 80%.
const menu = ({ items }: ISalesReport): Finding | null => {
  if (items.length < 2) return null;
  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
  const revenue = sorted.reduce((sum, item) => sum + item.revenue, 0);
  if (revenue <= 0) return null;
  const top = shareOf(sorted[0].revenue, revenue);
  if (top >= TOP_ITEM_FROM) return { id: "menu", section: "menu", text: `${sorted[0].name} alone is ${percent(top)} of revenue.` };
  let cumulative = 0;
  let n = 0;
  for (const item of sorted) {
    cumulative += item.revenue;
    n += 1;
    if (cumulative >= revenue * 0.8) break;
  }
  if (n >= sorted.length) return null;
  return { id: "menu", section: "menu", text: `${n} of ${sorted.length} dishes make 80% of revenue.` };
};

// The leading refund cause, and the hour the refunds cluster in if they do.
const refunds = ({ refunds, totals }: ISalesReport): Finding | null => {
  if (refunds.count < REFUNDS_FROM) return null;
  const top = [...refunds.byReason].sort((a, b) => b.count - a.count)[0];
  const hour = [...refunds.byHour].sort((a, b) => b.count - a.count)[0];
  const cluster = hour && shareOf(hour.count, refunds.count) >= CLUSTER_FROM ? `, most of them ${hourSpan(hour.hour)}` : "";
  if (!top?.reason) {
    return {
      id: "refunds",
      section: "refunds",
      text: `${formatCount(refunds.count)} refunds came to ${formatPrice(totals.refunds)}, ${formatPercent(shareOf(totals.refunds, totals.gross))} of gross sales${cluster}.`,
    };
  }
  const label = refundReasonText(top.reason) ?? top.reason;
  return {
    id: "refunds",
    section: "refunds",
    text: `“${label}” is the most common refund cause, ${formatCount(top.count)} of ${formatCount(refunds.count)} (${formatPrice(top.amount)})${cluster}.`,
  };
};

// How many diners had been before, and how that moved.
const repeat = ({ totals, previous }: ISalesReport): Finding | null => {
  if (totals.diners < DINERS_FROM) return null;
  const share = shareOf(totals.returningDiners, totals.diners);
  let moved = "";
  if (previous && previous.totals.diners >= DINERS_FROM) {
    const change = changeOf(share, shareOf(previous.totals.returningDiners, previous.totals.diners), "percent");
    moved = change?.direction === "same" ? ", the same as the period before" : change ? `, ${change.direction} ${change.text.replace(/ pt$/, " points")} on the period before` : "";
  }
  return { id: "repeat", section: "diners", text: `${percent(share)} of diners had been before${moved}.` };
};

// The table that takes the most net sales.
const tables = ({ tables }: ISalesReport): Finding | null => {
  if (tables.length < 2) return null;
  const net = tables.reduce((sum, t) => sum + t.net, 0);
  if (net <= 0) return null;
  const top = [...tables].sort((a, b) => b.net - a.net)[0];
  if (top.net <= 0) return null;
  return { id: "tables", section: "tables", text: `${top.name ?? "A table since deleted"} took ${percent(shareOf(top.net, net))} of net sales.` };
};

// Payments the provider hasn't confirmed, which no figure counts yet.
const pending = ({ totals }: ISalesReport): Finding | null =>
  totals.pendingOrders > 0
    ? {
        id: "pending",
        section: "trend",
        text: `${formatCount(totals.pendingOrders)} ${totals.pendingOrders === 1 ? "payment" : "payments"} still await${totals.pendingOrders === 1 ? "s" : ""} the provider and ${totals.pendingOrders === 1 ? "isn't" : "aren't"} counted.`,
      }
    : null;

const RULES = [mover, busiest, menu, refunds, repeat, tables, pending];

export const findings = (report: ISalesReport): Finding[] =>
  RULES.map((rule) => rule(report))
    .filter((f): f is Finding => f !== null)
    .slice(0, MAX_FINDINGS);

