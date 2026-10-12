import { memo, useMemo } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, TooltipContentProps, XAxis, YAxis } from "recharts";
import { bucketLabel, bucketLabelLong, formatAxis, formatCount, formatPercent, formatRange, shareOf } from "../../../lib/sales";
import { ChartBox, ChartTooltip, HiddenTable, Section } from "./ChartBits";
import { COLOURS } from "./colours";
import type { ISalesReport } from "../../../typings/sales";

interface Point {
  bucket: string;
  newDiners: number;
  returning: number;
  share: number | null;
  visits: number;
}

// Do people come back: new against returning diners per bucket as stacked
// bars, the returning share as a line, and visits per diner for the period.
// A returning diner had paid at the shop before the period began.
const DinersChart = ({ report }: { report: ISalesReport }) => {
  const { series, totals, range } = report;
  const { by } = range;
  const points = useMemo<Point[]>(
    () =>
      series.map((b) => ({
        bucket: b.bucket,
        newDiners: b.newDiners,
        returning: b.diners - b.newDiners,
        share: b.diners ? shareOf(b.diners - b.newDiners, b.diners) : null,
        visits: b.visits,
      })),
    [series]
  );
  const perDiner = shareOf(totals.visits, totals.diners);
  const caption = `New and returning diners by ${by}, ${formatRange(range)}: ${formatCount(totals.diners)} diners, ${formatCount(
    totals.returningDiners
  )} of them returning (${formatPercent(shareOf(totals.returningDiners, totals.diners))}), ${perDiner.toFixed(1)} visits per diner`;

  const tip = ({ active, payload }: TooltipContentProps) => {
    const p = payload?.[0]?.payload as Point | undefined;
    if (!active || !p) return null;
    return (
      <ChartTooltip>
        <div>{bucketLabelLong(p.bucket, by)}</div>
        <div className="value">{formatCount(p.newDiners + p.returning)} diners</div>
        <div className="text-body-secondary">
          {formatCount(p.newDiners)} new, {formatCount(p.returning)} returning{p.share !== null && ` (${formatPercent(p.share)})`}
        </div>
      </ChartTooltip>
    );
  };

  return (
    <Section id="diners" title="Diners">
      <figure className="chart diners" aria-label="New and returning diners">
        <div className="chart-head">
          <span className="text-body-secondary small">
            <span className="swatch a" aria-hidden="true" /> New <span className="swatch b" aria-hidden="true" /> Returning · line: returning share
          </span>
          <span className="text-body-secondary small ms-auto">{perDiner.toFixed(1)} visits per diner</span>
        </div>
        <ChartBox height={(w) => Math.min(300, Math.max(200, w * 0.36))}>
          {({ width, height }) => (
            <ComposedChart width={width} height={height} data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={COLOURS.grid} vertical={false} />
              <XAxis dataKey="bucket" tickFormatter={(b: string) => bucketLabel(b, by)} tick={{ fontSize: 12 }} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
              <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
              <YAxis
                yAxisId="share"
                orientation="right"
                domain={[0, 1]}
                tickFormatter={(v: number) => formatAxis("percent", v)}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip content={tip} cursor={{ fill: "var(--bs-tertiary-bg)" }} />
              <Bar yAxisId="count" dataKey="newDiners" name="New" stackId="diners" fill={COLOURS.a} isAnimationActive={false} />
              <Bar yAxisId="count" dataKey="returning" name="Returning" stackId="diners" fill={COLOURS.b} isAnimationActive={false} />
              <Line
                yAxisId="share"
                dataKey="share"
                name="Returning share"
                stroke={COLOURS.before}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            </ComposedChart>
          )}
        </ChartBox>
        <figcaption>{caption}</figcaption>
        <HiddenTable>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">New</th>
              <th scope="col">Returning</th>
              <th scope="col">Returning share</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.bucket}>
                <th scope="row">{bucketLabelLong(p.bucket, by)}</th>
                <td>{formatCount(p.newDiners)}</td>
                <td>{formatCount(p.returning)}</td>
                <td>{p.share === null ? "" : formatPercent(p.share)}</td>
              </tr>
            ))}
          </tbody>
        </HiddenTable>
      </figure>
    </Section>
  );
};

export default memo(DinersChart);
