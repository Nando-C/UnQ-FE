import { ReactNode, memo, useState } from "react";
import { Button } from "react-bootstrap";
import { Change, MetricKey, MetricKind, arrowOf, changeOf, formatCount, formatMetric, metric, metricOf, shareOf } from "../../../lib/sales";
import type { ISalesReport } from "../../../typings/sales";

// The headline figures with their change against the period before, when the
// comparison is on: net, orders, average order, refund rate, returning diners.
// The change's colour says whether it is good news, which for refunds is down.
// Gross, refunds, visits and units sold wait behind "More figures".

const Delta = ({ change, bad }: { change: Change | null; bad?: boolean }) => {
  if (!change) return <span className="kpi-delta same">new</span>;
  const tone = change.direction === "same" ? "same" : (change.direction === "up") !== !!bad ? "good" : "bad";
  const arrow = arrowOf(change.direction);
  return (
    <span className={`kpi-delta ${tone}`}>
      {arrow && <span aria-hidden="true">{arrow} </span>}
      <span className="visually-hidden">{change.direction === "same" ? "" : `${change.direction} `}</span>
      {change.text}
      <span className="visually-hidden"> on the period before</span>
    </span>
  );
};

interface CardProps {
  label: string;
  kind: MetricKind;
  value: number;
  // The period before's value, when the comparison is on.
  before?: number;
  bad?: boolean;
  note?: ReactNode;
}
const Card = ({ label, kind, value, before, bad, note }: CardProps) => (
  <li className="kpi">
    <span className="kpi-label">{label}</span>
    <span className="kpi-value">{formatMetric(kind, value)}</span>
    {before !== undefined && <Delta change={changeOf(value, before, kind)} bad={bad} />}
    {note && <span className="kpi-note">{note}</span>}
  </li>
);

const KpiCards = ({ report }: { report: ISalesReport }) => {
  const { totals, previous } = report;
  const [more, setMore] = useState(false);
  const ofMetric = (key: MetricKey, note?: ReactNode) => {
    const m = metric(key);
    return <Card label={m.label} kind={m.kind} value={metricOf(key, totals)} before={previous && metricOf(key, previous.totals)} bad={m.bad} note={note} />;
  };
  const returning = shareOf(totals.returningDiners, totals.diners);
  return (
    <>
      <ul className="kpis" aria-label="Headline figures">
        {ofMetric("net")}
        {ofMetric("orders", totals.pendingOrders > 0 && `${formatCount(totals.pendingOrders)} awaiting the provider`)}
        {ofMetric("avgOrder")}
        {ofMetric("refundRate")}
        <Card
          label="Returning diners"
          kind="percent"
          value={returning}
          before={previous && shareOf(previous.totals.returningDiners, previous.totals.diners)}
          note={`${formatCount(totals.returningDiners)} of ${formatCount(totals.diners)}`}
        />
        {more && ofMetric("gross")}
        {more && ofMetric("refunds")}
        {more && <Card label="Visits" kind="count" value={totals.visits} before={previous?.totals.visits} />}
        {more && ofMetric("units")}
      </ul>
      <Button variant="link" size="sm" className="more-figures" aria-expanded={more} onClick={() => setMore((m) => !m)}>
        {more ? "Fewer figures" : "More figures"}
      </Button>
    </>
  );
};

export default memo(KpiCards);
