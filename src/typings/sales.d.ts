// The sales report, as GET /shops/:shopId/sales answers it (the API's
// SalesReport schema). Money in pounds; days as "YYYY-MM-DD" in the shop's
// time zone; a returning diner had paid at the shop before the range began.

export type SalesGroupBy = "day" | "week" | "month";

export interface ISalesRange {
    from: string;
    to: string;
    timeZone: string;
    by: SalesGroupBy;
    days: number;
}

export interface ISalesByProvider<T> {
    paypal: T;
    stripe: T;
}

export interface ISalesTotals {
    gross: number;
    refunds: number;
    net: number;
    orders: number;
    pendingOrders: number;
    visits: number;
    diners: number;
    returningDiners: number;
    units: number;
    byProvider: ISalesByProvider<{ gross: number; orders: number }>;
}

// One bucket of the series; every bucket of the range is present, zero where
// nothing was sold. `bucket` is its first day.
export interface ISalesBucket {
    bucket: string;
    gross: number;
    refunds: number;
    net: number;
    orders: number;
    visits: number;
    diners: number;
    newDiners: number;
    units: number;
    byCategory: { food: number; drinks: number; other: number };
    byProvider: ISalesByProvider<number>;
}

export interface ISalesCell {
    dow: number; // ISO weekday, 1 Monday … 7 Sunday
    hour: number;
    orders: number;
    gross: number;
}

export interface ISalesItem {
    menuId: string;
    name: string;
    category: string | null;
    unitPrice: number;
    units: number;
    refundedUnits: number;
    revenue: number;
}

export interface ISalesRefunds {
    count: number;
    byReason: { reason: string | null; count: number; amount: number }[];
    byHour: { hour: number; count: number; amount: number }[];
}

export interface ISalesTable {
    tableId: string;
    name: string | null;
    orders: number;
    visits: number;
    gross: number;
    refunds: number;
    net: number;
}

export interface ISalesReport {
    range: ISalesRange;
    totals: ISalesTotals;
    series: ISalesBucket[];
    heatmap: ISalesCell[];
    items: ISalesItem[];
    refunds: ISalesRefunds;
    tables: ISalesTable[];
    // With compare=previous: the range of the same length ending the day before.
    previous?: { range: ISalesRange; totals: ISalesTotals; series: ISalesBucket[] };
}
