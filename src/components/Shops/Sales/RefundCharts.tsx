import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, TooltipContentProps, XAxis, YAxis } from "recharts";
import { refundReasonText } from "../../../lib/refundReasons";
import { formatAxis, formatCount, formatPercent, formatPrice, formatRange, hourLabel, hourSpan, shareOf } from "../../../lib/sales";
import { ChartBox, ChartTooltip, HiddenTable, Section } from "./ChartBits";
import { COLOURS } from "./colours";
import type { ISalesReport } from "../../../typings/sales";

const ROW_PX = 32;
const NO_REASON = "No reason recorded";

interface ReasonRow {
  label: string;
  count: number;
  amount: number;
  tag: string;
}

// What is given back and why: a bar per cause with its count and amount, and
// the refunds by the hour they were made. The rate itself is a trend metric.
const RefundCharts = ({ report }: { report: ISalesReport }) => {
  const { refunds, totals, range } = report;
  const reasons = useMemo<ReasonRow[]>(
    () =>
      [...refunds.byReason]
        .sort((a, b) => b.count - a.count || b.amount - a.amount)
        .map((r) => ({
          label: (r.reason && refundReasonText(r.reason)) || NO_REASON,
          count: r.count,
          amount: r.amount,
          tag: `${formatCount(r.count)} · ${formatPrice(r.amount)}`,
        })),
    [refunds.byReason]
  );
  const hours = useMemo(() => {
    if (refunds.byHour.length === 0) return [];
    const by = new Map(refunds.byHour.map((h) => [h.hour, h]));
    const min = Math.min(...refunds.byHour.map((h) => h.hour));
    const max = Math.max(...refunds.byHour.map((h) => h.hour));
    return Array.from({ length: max - min + 1 }, (_, i) => {
      const hour = min + i;
      const cell = by.get(hour);
      return { hour, label: hourLabel(hour), count: cell?.count ?? 0, amount: cell?.amount ?? 0 };
    });
  }, [refunds.byHour]);

  const summary = `${formatCount(refunds.count)} ${refunds.count === 1 ? "refund" : "refunds"}, ${formatPrice(totals.refunds)}, ${formatPercent(
    shareOf(totals.refunds, totals.gross)
  )} of gross sales, ${formatRange(range)}`;

  const reasonTip = ({ active, payload }: TooltipContentProps) => {
    const row = payload?.[0]?.payload as ReasonRow | undefined;
    if (!active || !row) return null;
    return (
      <ChartTooltip>
        <div>{row.label}</div>
        <div className="value">{formatCount(row.count)} {row.count === 1 ? "refund" : "refunds"}</div>
        <div className="text-body-secondary">{formatPrice(row.amount)}</div>
      </ChartTooltip>
    );
  };
  const hourTip = ({ active, payload }: TooltipContentProps) => {
    const row = payload?.[0]?.payload as (typeof hours)[number] | undefined;
    if (!active || !row) return null;
    return (
      <ChartTooltip>
        <div>{hourSpan(row.hour)}</div>
        <div className="value">{formatCount(row.count)} {row.count === 1 ? "refund" : "refunds"}</div>
        <div className="text-body-secondary">{formatPrice(row.amount)}</div>
      </ChartTooltip>
    );
  };

  return (
    <Section id="refunds" title="Refunds">
      {refunds.count === 0 ? (
        <figure className="chart">
          <p className="mb-0">No refunds in this period.</p>
        </figure>
      ) : (
        <>
          <figure className="chart reasons" aria-label="Refunds by cause">
            <ChartBox height={() => reasons.length * ROW_PX + 40}>
              {({ width, height }) => (
                <BarChart layout="vertical" width={width} height={height} data={reasons} margin={{ top: 4, right: 96, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={COLOURS.grid} horizontal={false} />
                  <XAxis type="number" domain={[0, "auto"]} allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} tickFormatter={(v: number) => formatAxis("count", v)} />
                  <YAxis type="category" dataKey="label" width={Math.min(170, Math.round(width * 0.42))} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
                  <Tooltip content={reasonTip} cursor={{ fill: "var(--bs-tertiary-bg)" }} />
                  <Bar dataKey="count" name="Refunds" fill={COLOURS.bad} radius={2} isAnimationActive={false}>
                    <LabelList dataKey="tag" position="right" fontSize={12} fill={COLOURS.text} />
                  </Bar>
                </BarChart>
              )}
            </ChartBox>
            <figcaption>Refunds by cause: {summary}</figcaption>
            <HiddenTable>
              <caption>Refunds by cause: {summary}</caption>
              <thead>
                <tr>
                  <th scope="col">Cause</th>
                  <th scope="col">Refunds</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {reasons.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td>{formatCount(r.count)}</td>
                    <td>{formatPrice(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </HiddenTable>
          </figure>
          {hours.length > 0 && (
            <figure className="chart hours" aria-label="Refunds by hour">
              <ChartBox height={() => 160}>
                {({ width, height }) => (
                  <BarChart width={width} height={height} data={hours} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={COLOURS.grid} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} minTickGap={16} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip content={hourTip} cursor={{ fill: "var(--bs-tertiary-bg)" }} />
                    <Bar dataKey="count" name="Refunds" fill={COLOURS.bad} radius={2} isAnimationActive={false} />
                  </BarChart>
                )}
              </ChartBox>
              <figcaption>Refunds by the hour they were made, {hourLabel(hours[0].hour)} to {hourLabel((hours[hours.length - 1].hour + 1) % 24)}</figcaption>
              <HiddenTable>
                <caption>Refunds by the hour they were made</caption>
                <thead>
                  <tr>
                    <th scope="col">Hour</th>
                    <th scope="col">Refunds</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {hours.filter((h) => h.count > 0).map((h) => (
                    <tr key={h.hour}>
                      <th scope="row">{hourSpan(h.hour)}</th>
                      <td>{formatCount(h.count)}</td>
                      <td>{formatPrice(h.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </HiddenTable>
            </figure>
          )}
        </>
      )}
    </Section>
  );
};

export default RefundCharts;
