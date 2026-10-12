import { formatPrice } from "./price";
import type { ISalesBucket, ISalesTotals, SalesGroupBy } from "../typings/sales";

// The sales page's arithmetic, all pure: days in the shop's time zone, the
// range presets and stepping, the grouping and comparison defaults (the same
// rules as the API's), the metrics the trend chart can show, the moving
// average, the URL state and the formatting. Days are "YYYY-MM-DD" text; the
// calendar maths treats them as UTC dates, which keeps it free of the
// browser's zone and its clock changes.

export type Day = string;
export interface DayRange {
  from: Day;
  to: Day;
}

// What the API counts in when a shop has no zone of its own.
export const DEFAULT_TIME_ZONE = "Europe/London";
export const MAX_REPORT_DAYS = 366;

const DAY_MS = 86_400_000;
const asUtc = (day: Day) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const dayOfUtc = (ms: number): Day => new Date(ms).toISOString().slice(0, 10);

export const isDay = (text: unknown): text is Day =>
  typeof text === "string" && /^\d{4}-\d{2}-\d{2}$/.test(text) && Number.isFinite(asUtc(text)) && dayOfUtc(asUtc(text)) === text;
export const addDays = (day: Day, n: number): Day => dayOfUtc(asUtc(day) + n * DAY_MS);
// Both ends counted.
export const daysBetween = (from: Day, to: Day) => Math.round((asUtc(to) - asUtc(from)) / DAY_MS) + 1;
// Weeks start on Monday.
export const weekStart = (day: Day): Day => addDays(day, -((new Date(asUtc(day)).getUTCDay() + 6) % 7));
export const monthStart = (day: Day): Day => `${day.slice(0, 8)}01`;
const monthEnd = (day: Day): Day => {
  const d = new Date(asUtc(day));
  return dayOfUtc(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
};
const addMonths = (day: Day, n: number): Day => {
  const d = new Date(asUtc(day));
  return dayOfUtc(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
};

// Today in a time zone (the shop's), whatever the browser's. An unknown zone
// name falls back to the default rather than throwing.
export const todayIn = (timeZone: string, now: Date = new Date()): Day => {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return todayIn(DEFAULT_TIME_ZONE, now);
  }
};

// ---- Ranges ---------------------------------------------------------------

export type PresetKey = "today" | "yesterday" | "week" | "last7" | "month" | "last30" | "last90";
export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "last7", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
];
export const DEFAULT_PRESET: PresetKey = "last30";

export const presetRange = (key: PresetKey, today: Day): DayRange => {
  switch (key) {
    case "today": return { from: today, to: today };
    case "yesterday": return { from: addDays(today, -1), to: addDays(today, -1) };
    case "week": return { from: weekStart(today), to: today };
    case "last7": return { from: addDays(today, -6), to: today };
    case "month": return { from: monthStart(today), to: today };
    case "last30": return { from: addDays(today, -29), to: today };
    case "last90": return { from: addDays(today, -89), to: today };
  }
};
// The preset a range is, if it is one.
export const presetOf = (range: DayRange, today: Day): PresetKey | null =>
  PRESETS.find(({ key }) => {
    const r = presetRange(key, today);
    return r.from === range.from && r.to === range.to;
  })?.key ?? null;

// The range before or after this one. A range that starts on the 1st steps by
// whole months (so This month, stepped back, is all of last month); any other
// steps by its own length.
export const stepRange = ({ from, to }: DayRange, direction: -1 | 1): DayRange => {
  if (from === monthStart(from) && (to === monthEnd(to) || daysBetween(from, to) <= 31)) {
    const start = addMonths(from, direction);
    return { from: start, to: monthEnd(start) };
  }
  const length = daysBetween(from, to);
  return { from: addDays(from, direction * length), to: addDays(to, direction * length) };
};

// A range the API accepts: real days, in order, at most 366 of them.
export const validRange = (range: Partial<DayRange>): range is DayRange =>
  isDay(range.from) && isDay(range.to) && range.from <= range.to && daysBetween(range.from, range.to) <= MAX_REPORT_DAYS;

// The API's own defaults, mirrored so the controls show the right value before
// the answer arrives.
export const groupByFor = (range: DayRange): SalesGroupBy => (daysBetween(range.from, range.to) <= 92 ? "day" : "week");
export const compareDefault = (range: DayRange) => daysBetween(range.from, range.to) >= 7;
// The 7-day average is a reading aid for daily buckets; drawn by default from
// two weeks, offered from one, never under that.
export const averageAllowed = (by: SalesGroupBy, days: number) => by === "day" && days >= 7;
export const averageDefault = (by: SalesGroupBy, days: number) => by === "day" && days >= 14;

// ---- Metrics ----------------------------------------------------------------

export type MetricKind = "money" | "count" | "percent";
export type MetricKey = "net" | "gross" | "refunds" | "orders" | "avgOrder" | "avgVisit" | "diners" | "units" | "refundRate";
export interface Metric {
  key: MetricKey;
  label: string;
  kind: MetricKind;
  // Going up is bad news (refunds): the change is coloured the other way round.
  bad?: boolean;
}
export const METRICS: Metric[] = [
  { key: "net", label: "Net sales", kind: "money" },
  { key: "gross", label: "Gross sales", kind: "money" },
  { key: "refunds", label: "Refunds", kind: "money", bad: true },
  { key: "orders", label: "Orders", kind: "count" },
  { key: "avgOrder", label: "Average order", kind: "money" },
  { key: "avgVisit", label: "Average visit", kind: "money" },
  { key: "diners", label: "Diners", kind: "count" },
  { key: "units", label: "Units sold", kind: "count" },
  { key: "refundRate", label: "Refund rate", kind: "percent", bad: true },
];
export const DEFAULT_METRIC: MetricKey = "net";
export const metric = (key: MetricKey): Metric => METRICS.find((m) => m.key === key) ?? METRICS[0];
export const isMetricKey = (text: unknown): text is MetricKey => METRICS.some((m) => m.key === text);

// A metric's value for a bucket or the totals. Ratios are made here, never by
// adding the API's figures up differently; a share of nothing is 0.
export const metricOf = (key: MetricKey, of: ISalesBucket | ISalesTotals): number => {
  switch (key) {
    case "avgOrder": return of.orders ? of.gross / of.orders : 0;
    case "avgVisit": return of.visits ? of.gross / of.visits : 0;
    case "refundRate": return of.gross ? of.refunds / of.gross : 0;
    default: return of[key];
  }
};

// The trailing average over `window` points; null until a full window is in.
export const movingAverage = (values: number[], window = 7): (number | null)[] =>
  values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return slice.reduce((s, v) => s + v, 0) / window;
  });

// The change from `previous` to `current`: a percentage for money and counts
// (none when there was nothing before), a difference in points for a rate.
export interface Change {
  direction: "up" | "down" | "same";
  text: string;
}
// A difference too small to show (0.0) is no change.
export const changeOf = (current: number, previous: number, kind: MetricKind): Change | null => {
  const same = { direction: "same" as const, text: "no change" };
  if (kind === "percent") {
    const points = (Math.abs(current - previous) * 100).toFixed(1);
    if (points === "0.0") return same;
    return { direction: current > previous ? "up" : "down", text: `${points} pt` };
  }
  if (previous === 0) return current === 0 ? same : null;
  const percent = (Math.abs((current - previous) / previous) * 100).toFixed(1);
  if (percent === "0.0") return same;
  return { direction: current > previous ? "up" : "down", text: `${percent}%` };
};

// ---- Formatting -------------------------------------------------------------

const count = new Intl.NumberFormat("en-GB");
export const formatCount = (n: number) => count.format(Math.round(n));
export const formatPercent = (share: number) => `${(share * 100).toFixed(1)}%`;
export const formatMetric = (kind: MetricKind, value: number) =>
  kind === "money" ? formatPrice(value) : kind === "percent" ? formatPercent(value) : formatCount(value);
// Shorter, for an axis: pounds rounded, counts, whole percentages.
export const formatAxis = (kind: MetricKind, value: number) =>
  kind === "money" ? `£${count.format(Math.round(value))}` : kind === "percent" ? `${Math.round(value * 100)}%` : formatCount(value);

const utcDate = (day: Day) => new Date(asUtc(day));
const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const weekdayDayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const monthYear = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" });

// "3 Oct" / "Sat 3 Oct"
export const formatDay = (day: Day) => dayMonth.format(utcDate(day));
export const formatDayLong = (day: Day) => weekdayDayMonth.format(utcDate(day));
// "12 Sep – 11 Oct 2026", "11 Oct 2026" for one day, both years when they differ.
export const formatRange = ({ from, to }: DayRange) => {
  if (from === to) return dayMonthYear.format(utcDate(to));
  const first = from.slice(0, 4) === to.slice(0, 4) ? dayMonth.format(utcDate(from)) : dayMonthYear.format(utcDate(from));
  return `${first} – ${dayMonthYear.format(utcDate(to))}`;
};
// A bucket's name on the axis and in the tables: its day, "w/c 5 Oct", "Oct 2026".
export const bucketLabel = (bucket: Day, by: SalesGroupBy) =>
  by === "day" ? formatDay(bucket) : by === "week" ? `w/c ${formatDay(bucket)}` : monthYear.format(utcDate(bucket));
export const bucketLabelLong = (bucket: Day, by: SalesGroupBy) => (by === "day" ? formatDayLong(bucket) : bucketLabel(bucket, by));

// ---- The URL ----------------------------------------------------------------

// What the page keeps in its query string, so a refresh, the back button and
// a shared link keep the view. Only what differs from the defaults is written.
export interface SalesState extends DayRange {
  by?: SalesGroupBy;
  metric: MetricKey;
  compare?: boolean;
  average?: boolean;
}
const GROUPS: SalesGroupBy[] = ["day", "week", "month"];
const flag = (text: string | null) => (text === "1" ? true : text === "0" ? false : undefined);

export const parseSalesSearch = (params: URLSearchParams, today: Day): SalesState => {
  const asked = { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined };
  const range = validRange(asked) ? asked : presetRange(DEFAULT_PRESET, today);
  const by = params.get("by");
  const metricKey = params.get("metric");
  return {
    ...range,
    ...(GROUPS.includes(by as SalesGroupBy) && { by: by as SalesGroupBy }),
    metric: isMetricKey(metricKey) ? metricKey : DEFAULT_METRIC,
    ...(flag(params.get("compare")) !== undefined && { compare: flag(params.get("compare")) }),
    ...(flag(params.get("avg")) !== undefined && { average: flag(params.get("avg")) }),
  };
};

export const buildSalesSearch = (state: SalesState): URLSearchParams => {
  const params = new URLSearchParams({ from: state.from, to: state.to });
  if (state.by) params.set("by", state.by);
  if (state.metric !== DEFAULT_METRIC) params.set("metric", state.metric);
  if (state.compare !== undefined) params.set("compare", state.compare ? "1" : "0");
  if (state.average !== undefined) params.set("avg", state.average ? "1" : "0");
  return params;
};
