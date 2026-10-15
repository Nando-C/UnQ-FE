import { findings } from "./findings";
import { Change, Day, DayRange, addDays, changeOf } from "./sales";
import type { ISalesReport } from "../typings/sales";
import type { IDeletedTable } from "../typings/shop";
import type { ITableStatus } from "../typings/tables";

// A shop at a glance, on My Shops: the week's report with fixed ranges (the
// last seven days against the seven before, today being the last bucket) and
// the tables' status, read into a few figures and a line. Pure, so each
// reading is tested on its own; the card only shows what comes out.

// The range the card reads: today and the six days before, in the shop's days.
export const glanceRange = (today: Day): DayRange => ({ from: addDays(today, -6), to: today });

export interface Glance {
  // The report's bucket for today (zero when nothing was sold yet).
  today: { net: number; orders: number };
  // The seven days, and their change on the seven before.
  week: { net: number; orders: number; change: Change | null };
  // The dish with the most revenue in the week, as the sales page ranks them.
  bestSeller: { name: string; revenue: number; units: number } | null;
  // The first highlight the sales page would write for the week that the
  // card doesn't already show (the week's net sales and their change are on
  // it), said of the week rather than "the period".
  highlight: string | null;
}

export const glanceOf = (report: ISalesReport, today: Day): Glance => {
  const todayBucket = report.series.find((b) => b.bucket === today);
  const { totals, previous } = report;
  const top = report.items.length > 0 ? [...report.items].sort((a, b) => b.revenue - a.revenue)[0] : null;
  return {
    today: { net: todayBucket?.net ?? 0, orders: todayBucket?.orders ?? 0 },
    week: { net: totals.net, orders: totals.orders, change: previous ? changeOf(totals.net, previous.totals.net, "money") : null },
    bestSeller: top ? { name: top.name, revenue: top.revenue, units: top.units } : null,
    highlight: findings(report).find((f) => !(f.id === "mover" && f.metric === "net"))?.text.replace(/the period before/g, "the week before") ?? null,
  };
};

// What the tables ask of staff right now, from the tables' status and the
// deleted tables the shop lists: how many tables carry a flag (a sold-out
// item ordered, a selection held too long, two open carts, a payment the
// provider hasn't confirmed, a diner to pay back), what is still owed at the
// open carts, and how many diners are owed a pay-back.
export interface Needs {
  flagged: number;
  owed: number;
  payBacks: number;
}

export const needsOf = (statuses: ITableStatus[], deletedTables: IDeletedTable[] = []): Needs => ({
  flagged: statuses.filter((t) => t.attention.length > 0).length + deletedTables.filter((t) => t.needsAttention).length,
  owed: statuses.reduce((sum, t) => sum + t.owed, 0),
  payBacks: statuses.filter((t) => t.attention.includes("payBack")).length,
});
