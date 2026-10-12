import { memo, useMemo } from "react";
import { Col, Row, Table } from "react-bootstrap";
import { Area, AreaChart, CartesianGrid, Tooltip, TooltipContentProps, XAxis, YAxis } from "recharts";
import { bucketLabel, bucketLabelLong, formatAxis, formatCount, formatPercent, formatPrice, formatRange, shareOf } from "../../../lib/sales";
import { ChartBox, ChartTooltip, HiddenTable, Section, SortHeader } from "./ChartBits";
import { useSort } from "../../../lib/useSort";
import { COLOURS } from "./colours";
import type { ISalesReport, ISalesTable } from "../../../typings/sales";

type SortKey = "name" | "orders" | "visits" | "net" | "avgVisit";
const DELETED = "Deleted table";

interface TableRow extends ISalesTable {
  avgVisit: number;
}
interface Point {
  bucket: string;
  paypal: number;
  stripe: number;
}

// Which tables earn, and how people pay: the per-table figures with the
// average visit, sortable; PayPal against card as a stacked area over time.
const TablesAndPayment = ({ report }: { report: ISalesReport }) => {
  const { tables, series, totals, range } = report;
  const { by } = range;
  const { sort, sortBy } = useSort<SortKey>({ key: "net", desc: true }, ["name"]);
  const rows = useMemo<TableRow[]>(() => {
    const dir = sort.desc ? -1 : 1;
    return tables
      .map((t) => ({ ...t, avgVisit: shareOf(t.gross, t.visits) }))
      .sort((a, b) => (sort.key === "name" ? (a.name ?? DELETED).localeCompare(b.name ?? DELETED) : a[sort.key] - b[sort.key]) * dir);
  }, [tables, sort]);
  const header = (column: SortKey, label: string, numeric = false) => <SortHeader column={column} label={label} numeric={numeric} sort={sort} onSort={sortBy} />;

  const points = useMemo<Point[]>(
    () => series.map((b) => ({ bucket: b.bucket, paypal: b.byProvider.paypal, stripe: b.byProvider.stripe })),
    [series]
  );
  const paypalShare = shareOf(totals.byProvider.paypal.gross, totals.gross);
  const mixCaption = `Gross sales by payment method by ${by}, ${formatRange(range)}: PayPal ${formatPercent(paypalShare)} (${formatCount(
    totals.byProvider.paypal.orders
  )} orders), card ${formatPercent(totals.gross ? 1 - paypalShare : 0)} (${formatCount(totals.byProvider.stripe.orders)} orders)`;

  const tip = ({ active, payload }: TooltipContentProps) => {
    const p = payload?.[0]?.payload as Point | undefined;
    if (!active || !p) return null;
    return (
      <ChartTooltip>
        <div>{bucketLabelLong(p.bucket, by)}</div>
        <div className="value">{formatPrice(p.paypal + p.stripe)}</div>
        <div className="text-body-secondary">
          PayPal {formatPrice(p.paypal)} · card {formatPrice(p.stripe)}
        </div>
      </ChartTooltip>
    );
  };

  return (
    <Section id="tables" title="Tables and payment">
      <Row className="g-3">
        <Col xs={12} lg={7}>
          <div className="chart tables h-100">
            {rows.length === 0 ? (
              <p className="mb-0">No sales at a table in this period.</p>
            ) : (
              <Table size="sm" responsive className="mb-0 tables-table">
                <caption className="visually-hidden">Sales by table, {formatRange(range)}</caption>
                <thead>
                  <tr>
                    {header("name", "Table")}
                    {header("orders", "Orders", true)}
                    {header("visits", "Visits", true)}
                    {header("net", "Net", true)}
                    {header("avgVisit", "Per visit", true)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.tableId}>
                      <th scope="row" className="fw-normal">
                        {t.name ?? <span className="text-body-secondary">{DELETED}</span>}
                      </th>
                      <td className="text-end">{formatCount(t.orders)}</td>
                      <td className="text-end">{formatCount(t.visits)}</td>
                      <td className="text-end">{formatPrice(t.net)}</td>
                      <td className="text-end">{formatPrice(t.avgVisit)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </Col>
        <Col xs={12} lg={5}>
          <figure className="chart mix h-100" aria-label="Payment methods">
            <div className="chart-head">
              <span className="text-body-secondary small">
                <span className="swatch a" aria-hidden="true" /> PayPal {formatPercent(paypalShare)} <span className="swatch b" aria-hidden="true" /> Card{" "}
                {formatPercent(totals.gross ? 1 - paypalShare : 0)}
              </span>
            </div>
            <ChartBox height={() => 180} fallback={320}>
              {({ width, height }) => (
                <AreaChart width={width} height={height} data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={COLOURS.grid} vertical={false} />
                  <XAxis dataKey="bucket" tickFormatter={(b: string) => bucketLabel(b, by)} tick={{ fontSize: 12 }} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
                  <YAxis tickFormatter={(v: number) => formatAxis("money", v)} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={52} />
                  <Tooltip content={tip} cursor={{ stroke: COLOURS.grid }} />
                  <Area type="monotone" dataKey="paypal" name="PayPal" stackId="mix" stroke={COLOURS.a} fill={COLOURS.a} fillOpacity={0.6} isAnimationActive={false} />
                  <Area type="monotone" dataKey="stripe" name="Card" stackId="mix" stroke={COLOURS.b} fill={COLOURS.b} fillOpacity={0.4} isAnimationActive={false} />
                </AreaChart>
              )}
            </ChartBox>
            <figcaption>{mixCaption}</figcaption>
            <HiddenTable>
              <caption>{mixCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">PayPal</th>
                  <th scope="col">Card</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.bucket}>
                    <th scope="row">{bucketLabelLong(p.bucket, by)}</th>
                    <td>{formatPrice(p.paypal)}</td>
                    <td>{formatPrice(p.stripe)}</td>
                  </tr>
                ))}
              </tbody>
            </HiddenTable>
          </figure>
        </Col>
      </Row>
    </Section>
  );
};

export default memo(TablesAndPayment);
