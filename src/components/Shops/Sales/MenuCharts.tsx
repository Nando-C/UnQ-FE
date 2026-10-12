import { useMemo, useState } from "react";
import { Button, Table } from "react-bootstrap";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  TooltipContentProps,
  XAxis,
  YAxis,
  ZAxis,
  Cell,
  Label,
} from "recharts";
import { formatAxis, formatCount, formatPercent, formatPrice, formatRange, shareOf } from "../../../lib/sales";
import { ChartBox, ChartTooltip, Section } from "./ChartBits";
import { COLOURS } from "./colours";
import type { ISalesItem, ISalesReport } from "../../../typings/sales";

type Category = "all" | "food" | "drinks";
type SortKey = "name" | "category" | "unitPrice" | "units" | "refundedUnits" | "revenue";

// How many dishes the Pareto draws; the rest are in the table.
const BARS = 12;
// The share of revenue the "n dishes make" marker is drawn at.
const PARETO_AT = 0.8;
const ROW_PX = 28;

const categoryName = (c: string | null) => (c === "food" ? "Food" : c === "drinks" ? "Drinks" : "Other");
const shorten = (name: string, max: number) => (name.length > max ? `${name.slice(0, max - 1).trimEnd()}…` : name);
const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

interface ParetoRow extends ISalesItem {
  label: string;
  cumulative: number;
}

// What sells and what carries the revenue: a Pareto of dishes by revenue with
// the cumulative share, a units-against-price scatter that sorts the menu into
// stars, workhorses, puzzles and sleepers, and the full table behind "All
// items". The category filter applies to all three.
const MenuCharts = ({ report }: { report: ISalesReport }) => {
  const [category, setCategory] = useState<Category>("all");
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "revenue", desc: true });

  const items = useMemo(() => {
    const kept = category === "all" ? report.items : report.items.filter((i) => i.category === category);
    return [...kept].sort((a, b) => b.revenue - a.revenue);
  }, [report.items, category]);
  const revenue = items.reduce((sum, i) => sum + i.revenue, 0);
  const pareto = useMemo<ParetoRow[]>(() => {
    let running = 0;
    return items.map((item) => {
      running += item.revenue;
      return { ...item, label: item.name, cumulative: shareOf(running, revenue) };
    });
  }, [items, revenue]);
  const bars = pareto.slice(0, BARS);
  const makeEighty = pareto.findIndex((r) => r.cumulative >= PARETO_AT) + 1;
  const marker = makeEighty > 0 && makeEighty <= bars.length ? bars[makeEighty - 1] : null;

  const priceMedian = median(items.map((i) => i.unitPrice));
  const unitsMedian = median(items.map((i) => i.units));

  const sorted = useMemo(() => {
    const dir = sort.desc ? -1 : 1;
    return [...items].sort((a, b) => {
      const x = a[sort.key] ?? "";
      const y = b[sort.key] ?? "";
      return (typeof x === "string" && typeof y === "string" ? x.localeCompare(y) : Number(x) - Number(y)) * dir;
    });
  }, [items, sort]);
  const sortBy = (key: SortKey) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" && key !== "category" }));

  const hasCategories = report.items.some((i) => i.category === "food") && report.items.some((i) => i.category === "drinks");
  const which = category === "all" ? "" : `, ${category}`;
  const paretoCaption = `Revenue by dish${which}, ${formatRange(report.range)}${
    makeEighty > 0 && items.length > 1 ? `: ${makeEighty} of ${items.length} make ${Math.round(PARETO_AT * 100)}%` : ""
  }`;
  const scatterCaption = `Units sold against unit price${which}: stars sell many at a high price, workhorses many at a low one, puzzles few at a high price, sleepers few at a low one`;

  const paretoTip = ({ active, payload }: TooltipContentProps) => {
    const row = payload?.[0]?.payload as ParetoRow | undefined;
    if (!active || !row) return null;
    return (
      <ChartTooltip>
        <div>{row.name}</div>
        <div className="value">{formatPrice(row.revenue)}</div>
        <div className="text-body-secondary">
          {formatCount(row.units)} sold · {formatPercent(shareOf(row.revenue, revenue))} of revenue, {formatPercent(row.cumulative)} with those above
        </div>
      </ChartTooltip>
    );
  };
  const scatterTip = ({ active, payload }: TooltipContentProps) => {
    const item = payload?.[0]?.payload as ISalesItem | undefined;
    if (!active || !item) return null;
    return (
      <ChartTooltip>
        <div>{item.name}</div>
        <div className="value">
          {formatCount(item.units)} at {formatPrice(item.unitPrice)}
        </div>
        <div className="text-body-secondary">{formatPrice(item.revenue)} revenue</div>
      </ChartTooltip>
    );
  };

  const header = (key: SortKey, label: string, numeric = false) => (
    <th scope="col" className={numeric ? "text-end" : undefined} aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : undefined}>
      <button type="button" className="sort" onClick={() => sortBy(key)}>
        {label}
        {sort.key === key && <span aria-hidden="true">{sort.desc ? " ▾" : " ▴"}</span>}
      </button>
    </th>
  );

  return (
    <Section id="menu" title="Menu">
      {hasCategories && (
        <div role="group" aria-label="Category" className="chips mb-3">
          {(["all", "food", "drinks"] as Category[]).map((key) => (
            <Button
              key={key}
              variant={category === key ? "primary" : "outline-primary"}
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              {key === "all" ? "All" : categoryName(key)}
            </Button>
          ))}
        </div>
      )}
      {items.length === 0 ? (
        <figure className="chart">
          <p className="mb-0">Nothing sold{which}.</p>
        </figure>
      ) : (
        <>
          <figure className="chart pareto" aria-label="Revenue by dish">
            <ChartBox height={() => bars.length * ROW_PX + 56}>
              {({ width, height }) => (
                <ComposedChart
                  layout="vertical"
                  width={width}
                  height={height}
                  data={bars}
                  margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke={COLOURS.grid} horizontal={false} />
                  <XAxis
                    xAxisId="money"
                    type="number"
                    domain={[0, "auto"]}
                    tickFormatter={(v: number) => formatAxis("money", v)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <XAxis xAxisId="share" type="number" domain={[0, 1]} orientation="top" tickFormatter={(v: number) => formatAxis("percent", v)} tick={{ fontSize: 12 }} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={Math.min(170, Math.round(width * 0.42))}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickFormatter={(v: string) => shorten(v, width < 480 ? 16 : 26)}
                  />
                  <Tooltip content={paretoTip} cursor={{ fill: "var(--bs-tertiary-bg)" }} />
                  <Bar xAxisId="money" dataKey="revenue" name="Revenue" fill={COLOURS.metric} radius={2} isAnimationActive={false} />
                  <Line
                    xAxisId="share"
                    dataKey="cumulative"
                    name="Cumulative share"
                    stroke={COLOURS.before}
                    strokeWidth={1.5}
                    dot={{ r: 2, strokeWidth: 0, fill: COLOURS.before }}
                    isAnimationActive={false}
                  />
                  <ReferenceLine xAxisId="share" x={PARETO_AT} stroke={COLOURS.before} strokeDasharray="4 4" />
                  {marker && (
                    <ReferenceLine xAxisId="money" y={marker.label} stroke={COLOURS.text} strokeOpacity={0.5}>
                      <Label value={`${makeEighty} make 80%`} position="insideTopRight" fontSize={12} fill={COLOURS.text} />
                    </ReferenceLine>
                  )}
                </ComposedChart>
              )}
            </ChartBox>
            <figcaption>{paretoCaption}</figcaption>
          </figure>
          <figure className="chart scatter" aria-label="Units against price">
            <ChartBox height={(w) => Math.min(320, Math.max(220, w * 0.4))}>
              {({ width, height }) => (
                <ScatterChart width={width} height={height} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke={COLOURS.grid} />
                  <XAxis
                    type="number"
                    dataKey="unitPrice"
                    name="Unit price"
                    domain={[0, "auto"]}
                    tickFormatter={(v: number) => formatAxis("money", v)}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  >
                    <Label value="Unit price" position="insideBottomRight" offset={-2} fontSize={12} fill={COLOURS.text} />
                  </XAxis>
                  <YAxis type="number" dataKey="units" name="Units" domain={[0, "auto"]} tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={44}>
                    <Label value="Units" position="insideTopLeft" fontSize={12} fill={COLOURS.text} />
                  </YAxis>
                  <ZAxis range={[60, 60]} />
                  <Tooltip content={scatterTip} cursor={{ strokeDasharray: "3 3", stroke: COLOURS.grid }} />
                  <ReferenceLine x={priceMedian} stroke={COLOURS.before} strokeDasharray="4 4">
                    <Label value="Puzzles" position="insideBottomRight" fontSize={12} fill={COLOURS.before} />
                    <Label value="Stars" position="insideTopRight" fontSize={12} fill={COLOURS.before} />
                  </ReferenceLine>
                  <ReferenceLine y={unitsMedian} stroke={COLOURS.before} strokeDasharray="4 4">
                    <Label value="Workhorses" position="insideTopLeft" fontSize={12} fill={COLOURS.before} />
                    <Label value="Sleepers" position="insideBottomLeft" fontSize={12} fill={COLOURS.before} />
                  </ReferenceLine>
                  <Scatter data={items} name="Dishes" isAnimationActive={false}>
                    {items.map((item) => (
                      <Cell key={item.menuId} fill={item.category === "drinks" ? COLOURS.b : COLOURS.a} />
                    ))}
                  </Scatter>
                </ScatterChart>
              )}
            </ChartBox>
            <figcaption>
              {scatterCaption}. <span className="swatch a" aria-hidden="true" /> Food <span className="swatch b" aria-hidden="true" /> Drinks
            </figcaption>
          </figure>
          <div className="chart items">
            <Button variant="outline-secondary" aria-expanded={open} aria-controls="sales-items" onClick={() => setOpen((o) => !o)}>
              {open ? "Hide the items" : `All items (${items.length})`}
            </Button>
            <div id="sales-items" className={open ? "mt-3" : "visually-hidden"}>
              <Table size="sm" responsive className="mb-0 items-table">
                <caption className="visually-hidden">{paretoCaption}; {scatterCaption}</caption>
                <thead>
                  <tr>
                    {header("name", "Item")}
                    {header("category", "Category")}
                    {header("unitPrice", "Unit price", true)}
                    {header("units", "Units", true)}
                    {header("refundedUnits", "Refunded", true)}
                    {header("revenue", "Revenue", true)}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((item) => (
                    <tr key={item.menuId}>
                      <th scope="row" className="fw-normal">{item.name}</th>
                      <td>{categoryName(item.category)}</td>
                      <td className="text-end">{formatPrice(item.unitPrice)}</td>
                      <td className="text-end">{formatCount(item.units)}</td>
                      <td className="text-end">{formatCount(item.refundedUnits)}</td>
                      <td className="text-end">{formatPrice(item.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </div>
        </>
      )}
    </Section>
  );
};

export default MenuCharts;
