import { useMemo, useRef } from "react";
import { Form } from "react-bootstrap";
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import {
  METRICS,
  MetricKey,
  averageAllowed,
  bucketLabel,
  bucketLabelLong,
  changeOf,
  formatAxis,
  formatMetric,
  formatRange,
  metric,
  metricOf,
  movingAverage,
} from "../../../lib/sales";
import { useElementWidth } from "../../../lib/useElementWidth";
import type { ISalesReport } from "../../../typings/sales";

interface TrendChartProps {
  report: ISalesReport;
  metricKey: MetricKey;
  onMetric: (key: MetricKey) => void;
  average: boolean;
  onAverage: (on: boolean) => void;
}

interface Point {
  bucket: string;
  label: string;
  value: number;
  previous?: number;
  previousBucket?: string;
  average: number | null;
}

// Where a long series stops showing a dot per point.
const DOTS_UP_TO = 31;
// From how many buckets the brush (a zoom handle under the chart) appears.
// The right margin leaves room for the peak's label on the last point.
const BRUSH_FROM = 32;

// The metric over time, as one line: the chart the page is built around. Its
// metric switches without a request (the series carries every one), the
// period before is a dashed ghost line, the 7-day average a lighter one, and
// the peak is annotated. The same numbers are in a table for screen readers.
const TrendChart = ({ report, metricKey, onMetric, average, onAverage }: TrendChartProps) => {
  const m = metric(metricKey);
  const { by, days } = report.range;
  const previous = report.previous;
  const points = useMemo<Point[]>(() => {
    const values = report.series.map((b) => metricOf(metricKey, b));
    const averages = movingAverage(values);
    return report.series.map((b, i) => ({
      bucket: b.bucket,
      label: bucketLabel(b.bucket, by),
      value: values[i],
      ...(previous?.series[i] && { previous: metricOf(metricKey, previous.series[i]), previousBucket: previous.series[i].bucket }),
      average: averages[i],
    }));
  }, [report.series, previous, metricKey, by]);

  const peak = points.reduce<Point | null>((best, p) => (p.value > 0 && (!best || p.value > best.value) ? p : best), null);
  const canAverage = averageAllowed(by, days);
  const showAverage = average && canAverage;
  const colour = m.bad ? "var(--bs-warning-text-emphasis)" : "var(--bs-primary)";

  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 640);
  const height = Math.round(Math.min(360, Math.max(240, width * 0.42)));

  const tooltip = ({ active, payload }: TooltipContentProps) => {
    const point = payload?.[0]?.payload as Point | undefined;
    if (!active || !point) return null;
    const change = point.previous !== undefined ? changeOf(point.value, point.previous, m.kind) : null;
    return (
      <div className="trend-tooltip">
        <div>{bucketLabelLong(point.bucket, by)}</div>
        <div className="value">{formatMetric(m.kind, point.value)}</div>
        {point.previousBucket !== undefined && point.previous !== undefined && (
          <div className="text-body-secondary">
            {bucketLabelLong(point.previousBucket, by)}: {formatMetric(m.kind, point.previous)}
            {change && change.direction !== "same" && ` (${change.direction === "up" ? "▲" : "▼"} ${change.text})`}
          </div>
        )}
        {showAverage && point.average !== null && <div className="text-body-secondary">7-day average {formatMetric(m.kind, point.average)}</div>}
      </div>
    );
  };

  const caption = `${m.label} by ${by}, ${formatRange(report.range)}${previous ? `, against ${formatRange(previous.range)}` : ""}`;

  return (
    <figure id="trend" className="chart trend" aria-label="Trend">
      <div className="chart-head">
        <Form.Select aria-label="Metric" value={metricKey} onChange={(e) => onMetric(e.target.value as MetricKey)}>
          {METRICS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Form.Select>
        {canAverage && (
          <Form.Check
            type="switch"
            id="sales-average"
            label="7-day average"
            checked={showAverage}
            onChange={(e) => onAverage(e.target.checked)}
          />
        )}
      </div>
      <div ref={box} aria-hidden="true">
        <ComposedChart width={width} height={height} data={points} margin={{ top: 24, right: 40, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--bs-border-color)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} minTickGap={24} interval="preserveStartEnd" />
          <YAxis
            domain={[0, "auto"]}
            tickFormatter={(v: number) => formatAxis(m.kind, v)}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={m.kind === "money" ? 60 : 44}
          />
          <Tooltip content={tooltip} cursor={{ stroke: "var(--bs-border-color)" }} />
          {previous && (
            <Line
              type="monotone"
              dataKey="previous"
              name="Period before"
              stroke="var(--bs-secondary-color)"
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          )}
          {showAverage && (
            <Line
              type="monotone"
              dataKey="average"
              name="7-day average"
              stroke={colour}
              strokeOpacity={0.5}
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            name={m.label}
            stroke={colour}
            strokeWidth={2}
            dot={points.length <= DOTS_UP_TO ? { r: 3, strokeWidth: 0, fill: colour } : false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          {peak && (
            <ReferenceDot
              x={peak.label}
              y={peak.value}
              r={4}
              fill={colour}
              stroke="var(--bs-body-bg)"
              label={{ value: formatMetric(m.kind, peak.value), position: "top", fontSize: 12, fill: "var(--bs-body-color)" }}
            />
          )}
          {points.length >= BRUSH_FROM && (
            <Brush dataKey="label" height={24} travellerWidth={8} stroke="var(--bs-border-color)" fill="var(--bs-tertiary-bg)" />
          )}
        </ComposedChart>
      </div>
      <figcaption>{caption}</figcaption>
      {/* The chart's numbers, for a screen reader. Hidden as a block around the
          table: a table itself can't shrink to the hidden box, and would widen
          the page. */}
      <div className="visually-hidden">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{m.label}</th>
            {previous && <th scope="col">Period before</th>}
            {showAverage && <th scope="col">7-day average</th>}
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.bucket}>
              <th scope="row">{bucketLabelLong(p.bucket, by)}</th>
              <td>{formatMetric(m.kind, p.value)}</td>
              {previous && <td>{p.previous !== undefined ? formatMetric(m.kind, p.previous) : ""}</td>}
              {showAverage && <td>{p.average === null ? "" : formatMetric(m.kind, p.average)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
};

export default TrendChart;
