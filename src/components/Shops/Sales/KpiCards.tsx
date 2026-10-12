import { Change, MetricKey, changeOf, formatCount, formatMetric, formatPercent, metric, metricOf } from "../../../lib/sales";
import type { ISalesReport, ISalesTotals } from "../../../typings/sales";

// The headline figures with their change against the period before, when the
// comparison is on: net, orders, average order, refund rate, returning diners.
// The change's colour says whether it is good news, which for refunds is down.

const share = (totals: ISalesTotals) => (totals.diners ? totals.returningDiners / totals.diners : 0);

const Delta = ({ change, bad }: { change: Change | null; bad?: boolean }) => {
  if (!change) return <span className="kpi-delta same">new</span>;
  const tone = change.direction === "same" ? "same" : (change.direction === "up") !== !!bad ? "good" : "bad";
  const arrow = change.direction === "up" ? "▲" : change.direction === "down" ? "▼" : "";
  return (
    <span className={`kpi-delta ${tone}`}>
      {arrow && <span aria-hidden="true">{arrow} </span>}
      <span className="visually-hidden">{change.direction === "same" ? "" : `${change.direction} `}</span>
      {change.text}
      <span className="visually-hidden"> on the period before</span>
    </span>
  );
};

const KpiCards = ({ report }: { report: ISalesReport }) => {
  const { totals, previous } = report;
  const card = (key: MetricKey) => {
    const m = metric(key);
    const value = metricOf(key, totals);
    return (
      <li key={key} className="kpi">
        <span className="kpi-label">{m.label}</span>
        <span className="kpi-value">{formatMetric(m.kind, value)}</span>
        {previous && <Delta change={changeOf(value, metricOf(key, previous.totals), m.kind)} bad={m.bad} />}
        {key === "orders" && totals.pendingOrders > 0 && (
          <span className="kpi-note">
            {formatCount(totals.pendingOrders)} awaiting the provider
          </span>
        )}
      </li>
    );
  };
  return (
    <ul className="kpis" aria-label="Headline figures">
      {card("net")}
      {card("orders")}
      {card("avgOrder")}
      {card("refundRate")}
      <li className="kpi">
        <span className="kpi-label">Returning diners</span>
        <span className="kpi-value">{formatPercent(share(totals))}</span>
        {previous && <Delta change={changeOf(share(totals), share(previous.totals), "percent")} />}
        <span className="kpi-note">
          {formatCount(totals.returningDiners)} of {formatCount(totals.diners)}
        </span>
      </li>
    </ul>
  );
};

export default KpiCards;
