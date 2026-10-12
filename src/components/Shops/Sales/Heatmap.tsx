import { CSSProperties, useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import { formatCount, formatPrice, formatRange, hourLabel, hourSpan, shareOf, weekdayName, weekdayShort, weekdaysIn } from "../../../lib/sales";
import { Section } from "./ChartBits";
import type { ISalesReport } from "../../../typings/sales";

type Measure = "orders" | "gross";

// When the shop sells: a weekday × hour grid, one cell per hour with sales,
// darker the busier. The grid is a real table, so the weekdays and hours are
// its headers and every cell's figure is in it for a screen reader; the
// colour is the reading aid. Under a week the rows are the days present.
const Heatmap = ({ report }: { report: ISalesReport }) => {
  const [measure, setMeasure] = useState<Measure>("orders");
  const { range, heatmap } = report;
  const rows = weekdaysIn(range);
  const { hours, cells, max } = useMemo(() => {
    const cells = new Map<string, { orders: number; gross: number }>();
    let min = 24;
    let maxHour = -1;
    let max = 0;
    for (const c of heatmap) {
      cells.set(`${c.dow}-${c.hour}`, c);
      min = Math.min(min, c.hour);
      maxHour = Math.max(maxHour, c.hour);
      max = Math.max(max, c[measure]);
    }
    const hours = maxHour < 0 ? [] : Array.from({ length: maxHour - min + 1 }, (_, i) => min + i);
    return { hours, cells, max };
  }, [heatmap, measure]);

  const format = (value: number) => (measure === "orders" ? formatCount(value) : formatPrice(value));
  const caption = `${measure === "orders" ? "Orders" : "Sales"} by weekday and hour, ${formatRange(range)}, ${
    hours.length ? `${hourLabel(hours[0])} to ${hourLabel((hours[hours.length - 1] + 1) % 24)}` : "no hours with sales"
  }`;

  return (
    <Section id="when" title="When you sell">
      <figure className="chart heatmap">
        <div className="chart-head">
          <div role="group" aria-label="Measure" className="chips">
            {(["orders", "gross"] as Measure[]).map((key) => (
              <Button
                key={key}

                variant={measure === key ? "primary" : "outline-primary"}
                aria-pressed={measure === key}
                onClick={() => setMeasure(key)}
              >
                {key === "orders" ? "Orders" : "Sales"}
              </Button>
            ))}
          </div>
          {max > 0 && (
            <span className="text-body-secondary small">
              Darkest: {format(max)} in an hour
            </span>
          )}
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
                      const value = cell?.[measure] ?? 0;
                      return (
                        <td
                          key={h}
                          style={{ "--heat": shareOf(value, max) } as CSSProperties}
                          title={cell ? `${weekdayName(dow)} ${hourSpan(h)}: ${formatCount(cell.orders)} orders, ${formatPrice(cell.gross)}` : undefined}
                        >
                          <span className="visually-hidden">{cell ? `${formatCount(cell.orders)} orders, ${formatPrice(cell.gross)}` : "none"}</span>
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

export default Heatmap;
