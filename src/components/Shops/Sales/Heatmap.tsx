import { CSSProperties, memo, useMemo, useState } from "react";
import { daysBetween, formatCount, formatPrice, formatRange, hourSpan, hoursLabel, hoursSpanning, shareOf, weekdayName, weekdayShort, weekdaysIn } from "../../../lib/sales";
import { Chips, Section } from "./ChartBits";
import type { ISalesReport } from "../../../typings/sales";

type Measure = "orders" | "gross";
const MEASURES: { value: Measure; label: string }[] = [
  { value: "orders", label: "Orders" },
  { value: "gross", label: "Sales" },
];

// When the shop sells: a weekday × hour grid, one cell per hour with sales,
// darker the busier. The grid is a real table, so the weekdays and hours are
// its headers and every cell's figure is in it for a screen reader; the
// colour is the reading aid. Under a week the rows are the days present.
const Heatmap = ({ report }: { report: ISalesReport }) => {
  const [measure, setMeasure] = useState<Measure>("orders");
  const { range, heatmap } = report;
  const rows = weekdaysIn(range);
  const { hours, cells } = useMemo(() => {
    const cells = new Map(heatmap.map((c) => [`${c.dow}-${c.hour}`, { ...c, text: `${formatCount(c.orders)} orders, ${formatPrice(c.gross)}` }]));
    return { hours: hoursSpanning(heatmap.map((c) => c.hour)), cells };
  }, [heatmap]);
  const max = useMemo(() => heatmap.reduce((m, c) => Math.max(m, c[measure]), 0), [heatmap, measure]);

  const format = (value: number) => (measure === "orders" ? formatCount(value) : formatPrice(value));
  // Totals over the period: a range that isn't whole weeks has one more of
  // some weekdays than others, which the caption says.
  const days = daysBetween(range.from, range.to);
  const caption = `${measure === "orders" ? "Orders" : "Sales"} by weekday and hour, ${formatRange(range)}, ${
    hours.length ? hoursLabel(hours[0], hours[hours.length - 1]) : "no hours with sales"
  }${days > 7 && days % 7 ? ", totals over a period that isn't whole weeks" : ""}`;

  return (
    <Section id="when" title="When you sell">
      <figure className="chart heatmap">
        <div className="chart-head">
          <Chips label="Measure" options={MEASURES} value={measure} onChange={setMeasure} />
          {max > 0 && <span className="text-body-secondary small">Darkest: {format(max)} in an hour</span>}
        </div>
        {hours.length === 0 ? (
          <p className="mb-0">No sales in this period.</p>
        ) : (
          <div className="heat-scroll">
            <table className="heat">
              <caption className="visually-hidden">{caption}</caption>
              <thead>
                <tr>
                  <td />
                  {hours.map((h) => (
                    <th key={h} scope="col">
                      <span aria-hidden="true">{h}</span>
                      <span className="visually-hidden">{hourSpan(h)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((dow) => (
                  <tr key={dow}>
                    <th scope="row">
                      <span aria-hidden="true">{weekdayShort(dow)}</span>
                      <span className="visually-hidden">{weekdayName(dow)}</span>
                    </th>
                    {hours.map((h) => {
                      const cell = cells.get(`${dow}-${h}`);
                      return (
                        <td
                          key={h}
                          style={{ "--heat": shareOf(cell?.[measure] ?? 0, max) } as CSSProperties}
                          title={cell && `${weekdayName(dow)} ${hourSpan(h)}: ${cell.text}`}
                        >
                          <span className="visually-hidden">{cell?.text ?? "none"}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <figcaption>{caption}</figcaption>
      </figure>
    </Section>
  );
};

export default memo(Heatmap);
