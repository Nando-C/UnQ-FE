import { formatPrice } from "./price";
export { formatPrice };
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
const MAX_REPORT_DAYS = 366;

const DAY_MS = 86_400_000;
const asUtc = (day: Day) => {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const dayOfUtc = (ms: number): Day => new Date(ms).toISOString().slice(0, 10);

const isDay = (text: unknown): text is Day =>
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
// name falls back to the default rather than throwing. The formatter for a
// zone is made once: it is asked for on every render.
const dayFormats = new Map<string, Intl.DateTimeFormat>();
export const todayIn = (timeZone: string, now: Date = new Date()): Day => {
  let format = dayFormats.get(timeZone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      return todayIn(DEFAULT_TIME_ZONE, now);
    }
    dayFormats.set(timeZone, format);
  }
  return format.format(now);
};

// ---- Weekdays and hours -----------------------------------------------------

// ISO weekdays, 1 Monday … 7 Sunday, as the API's heatmap numbers them.
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const weekdayName = (dow: number) => WEEKDAYS[dow - 1] ?? "";
export const weekdayShort = (dow: number) => weekdayName(dow).slice(0, 3);
const weekdayOf = (day: Day) => ((new Date(asUtc(day)).getUTCDay() + 6) % 7) + 1;
// How many times each weekday falls in a range (a 30-day range has five of
// two weekdays and four of the rest), for a fair share per weekday.
export const weekdayCounts = ({ from, to }: DayRange): Map<number, number> => {
  const days = daysBetween(from, to);
  const first = weekdayOf(from);
  return new Map(
    [1, 2, 3, 4, 5, 6, 7].map((dow) => {
      const offset = (dow - first + 7) % 7;
      return [dow, offset < days ? Math.floor((days - 1 - offset) / 7) + 1 : 0];
    })
  );
};
// The weekdays a range has, in Monday-first order: all seven from a week, only
// the days present under one (a single day's heatmap is a single row).
export const weekdaysIn = ({ from, to }: DayRange): number[] => {
  const days = Math.min(daysBetween(from, to), 7);
  const present = new Set(Array.from({ length: days }, (_, i) => weekdayOf(addDays(from, i))));
  return [1, 2, 3, 4, 5, 6, 7].filter((dow) => present.has(dow));
};
// "13:00", and an hour's span "13:00–14:00".
export const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
export const hourSpan = (hour: number) => `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}`;
// Every hour from the first to the last of those given, none when none.
export const hoursSpanning = (hours: number[]): number[] => {
  if (hours.length === 0) return [];
  const first = Math.min(...hours);
  return Array.from({ length: Math.max(...hours) - first + 1 }, (_, i) => first + i);
};
// "09:00 to 17:00": from the first hour's start to the last hour's end.
export const hoursLabel = (first: number, last: number) => `${hourLabel(first)} to ${hourLabel((last + 1) % 24)}`;
// A part of a whole, 0 when there is no whole.
export const shareOf = (part: number, whole: number) => (whole ? part / whole : 0);

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
const DEFAULT_PRESET: PresetKey = "last30";

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

export const monthsBetween = (from: Day, to: Day) => (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;

// What a range steps by: whole months or weeks (This month and This week are
// those units so far, and step to the whole unit before), else its own length.
export type StepUnit = "month" | "week";
// A range of whole months (the 1st to a month's end) steps by months unasked.
export const isWholeMonths = ({ from, to }: DayRange) => from === monthStart(from) && to === monthEnd(to);
// The range before or after this one. A range of whole months steps by as
// many months whether or not asked to; any other steps by its own length, so
// Today on the 1st steps to yesterday. A step that would reach past `today`
// stops there, so last month, stepped forward, is this month so far.
export const stepRange = ({ from, to }: DayRange, direction: -1 | 1, { today, unit }: { today?: Day; unit?: StepUnit } = {}): DayRange => {
  let next: DayRange;
  if (unit === "month" || isWholeMonths({ from, to })) {
    const months = monthsBetween(from, to);
    const start = addMonths(from, direction * months);
    next = { from: start, to: monthEnd(addMonths(start, months - 1)) };
  } else if (unit === "week") {
    const start = addDays(weekStart(from), direction * 7);
    next = { from: start, to: addDays(start, 6) };
  } else {
    const length = daysBetween(from, to);
    next = { from: addDays(from, direction * length), to: addDays(to, direction * length) };
  }
  return today && next.to > today && next.from <= today ? { from: next.from, to: today } : next;
};

// A range the API accepts: real days, in order, at most 366 of them.
export const validRange = (range: Partial<DayRange>): range is DayRange =>
  isDay(range.from) && isDay(range.to) && range.from <= range.to && daysBetween(range.from, range.to) <= MAX_REPORT_DAYS;

// The API's own defaults, mirrored so the controls show the right value before
// the answer arrives.
export const groupByFor = (range: DayRange): SalesGroupBy => (daysBetween(range.from, range.to) <= 92 ? "day" : "week");
export const compareDefault = (range: DayRange) => daysBetween(range.from, range.to) >= 7;
// The 7-day average is a reading aid for daily buckets, offered and drawn
// from two weeks of them (under that it is a point or two, which reads as a
// fault).
// Offered from one, never under that.
export const averageAllowed = (by: SalesGroupBy, days: number) => by === "day" && days >= 14;
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
const isMetricKey = (text: unknown): text is MetricKey => METRICS.some((m) => m.key === text);

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
export const movingAverage = (values: number[], window = 7): (number | null)[] => {
  let sum = 0;
  return values.map((value, i) => {
    sum += value - (i >= window ? values[i - window] : 0);
    return i < window - 1 ? null : sum / window;
  });
};

// The change from `previous` to `current`: a percentage for money and counts
// (none when there was nothing before), a difference in points for a rate.
export interface Change {
  direction: "up" | "down" | "same";
  text: string;
}
export const arrowOf = (direction: Change["direction"]) => (direction === "up" ? "▲" : direction === "down" ? "▼" : "");
// A difference too small to show (0.0) is no change. Nothing before has no
// percentage (null: the figure is new); less than nothing before (a period's
// refunds over its sales) is said as what it was.
export const changeOf = (current: number, previous: number, kind: MetricKind): Change | null => {
  const same = { direction: "same" as const, text: "no change" };
  if (kind === "percent") {
    const points = (Math.abs(current - previous) * 100).toFixed(1);
    if (points === "0.0") return same;
    return { direction: current > previous ? "up" : "down", text: `${points} pt` };
  }
  if (previous === 0) return current === 0 ? same : null;
  if (previous < 0) return current === previous ? same : { direction: current > previous ? "up" : "down", text: `from ${formatMetric(kind, previous)}` };
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
const formatDay = (day: Day) => dayMonth.format(utcDate(day));
const formatDayLong = (day: Day) => weekdayDayMonth.format(utcDate(day));
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
// The groupings, as the select names them.
export const GROUPS: { value: SalesGroupBy; label: string }[] = [
  { value: "day", label: "By day" },
  { value: "week", label: "By week" },
  { value: "month", label: "By month" },
];
const isGroupBy = (text: unknown): text is SalesGroupBy => GROUPS.some((g) => g.value === text);
const flag = (text: string | null) => (text === "1" ? true : text === "0" ? false : undefined);

export const parseSalesSearch = (params: URLSearchParams, today: Day): SalesState => {
  const asked = { from: params.get("from") ?? undefined, to: params.get("to") ?? undefined };
  const range = validRange(asked) ? asked : presetRange(DEFAULT_PRESET, today);
  const by = params.get("by");
  const metricKey = params.get("metric");
  const compare = flag(params.get("compare"));
  const average = flag(params.get("avg"));
  return {
    ...range,
    ...(isGroupBy(by) && { by }),
    metric: isMetricKey(metricKey) ? metricKey : DEFAULT_METRIC,
    ...(compare !== undefined && { compare }),
    ...(average !== undefined && { average }),
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
