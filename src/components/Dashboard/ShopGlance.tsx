import { Fragment, useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "react-bootstrap";
import backend from "../../backend/backend";
import { Needs, glanceOf, glanceRange, needsOf, todayRange } from "../../lib/glance";
import { arrowOf, buildSalesSearch, DEFAULT_METRIC, formatCount, formatPrice, todayIn } from "../../lib/sales";
import { apiErrorMessage } from "../../lib/errors";
import { useVisiblePolling } from "../../lib/useVisiblePolling";
import { useAppSelector } from "../../redux/app/hooks";
import { can, selectRoleOn } from "../../lib/roles";
import type { IShop } from "../../typings/shop";
import type { ISalesReport } from "../../typings/sales";
import type { ITableStatus } from "../../typings/tables";

// A shop's figures on its My Shops card: today so far, the seven full days to
// yesterday against the seven before, the week's best seller, one highlight,
// and, as the card's footer, what the tables need right now and when the
// card was last updated. Two reads, the figures (the sales report twice, the
// week and today, answered together) and the tables' status, asked for
// together every minute while the page is visible; each shows its own
// failure, so figures that can't load leave the tables' line standing, and a
// refresh that fails keeps the figures already shown and says it couldn't
// refresh. The figures are one link to the Sales tab on the same week; the
// footer links to the tables.

const REFRESH_MS = 60_000;

// What a read holds: its last good answer, if any, and the error of its last
// attempt, if it failed. Both absent while the first answer is awaited.
interface Loaded<T> {
  data?: T;
  error?: string;
}
const timeOf = (at: Date) => at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const ShopGlance = ({ shop }: { shop: IShop }) => {
  // The figures are the sales report, the owner's and managers' (lib/roles.ts);
  // a role without it gets the tables' line alone, and that read isn't made.
  const withFigures = can(useAppSelector((state) => selectRoleOn(state, shop._id)), "sales.read");
  const today = todayIn(shop.timeZone);
  const range = glanceRange(today);
  const [report, setReport] = useState<Loaded<FiguresData>>({});
  const [statuses, setStatuses] = useState<Loaded<ITableStatus[]>>({});
  // When the last answer of either read arrived.
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // The latest request wins: an older answer arriving late never replaces a newer one's.
  const requests = useRef(0);
  const { from, to } = range;
  const load = useCallback(() => {
    const request = ++requests.current;
    const fresh = () => request === requests.current;
    // An answer that says nothing new (most refreshes) redraws nothing but the time.
    const answered = <T,>(set: (f: (held: Loaded<T>) => Loaded<T>) => void) => (data: T) => {
      if (!fresh()) return;
      set((held) => (held.data && !held.error && JSON.stringify(held.data) === JSON.stringify(data) ? held : { data }));
      setUpdatedAt(new Date());
    };
    const failed = <T,>(set: (f: (held: Loaded<T>) => Loaded<T>) => void) => (err: unknown) => {
      if (fresh()) set((held) => ({ ...held, error: apiErrorMessage(err) }));
    };
    if (withFigures) {
      const report = (params: Record<string, string>) => backend.get<ISalesReport>(`/shops/${shop._id}/sales`, { params }).then(({ data }) => data);
      Promise.all([report({ from, to, by: "day", compare: "previous" }), report({ ...todayRange(today), by: "day" })])
        .then(([week, now]) => answered(setReport)({ week, today: now }), failed(setReport));
    }
    backend.get<ITableStatus[]>(`/shops/${shop._id}/tables/status`).then(({ data }) => answered(setStatuses)(data), failed(setStatuses));
  }, [shop._id, from, to, today, withFigures]);
  useVisiblePolling(load, REFRESH_MS);

  const salesHref = `/shop/${shop._id}/sales?${buildSalesSearch({ from, to, metric: DEFAULT_METRIC })}`;
  const tablesHref = `/shop/${shop._id}#tableList`;
  const awaited = (held: Loaded<unknown>) => !held.data && !held.error;
  // Over the reads made: a report never asked for is not awaited.
  const loading = (withFigures && awaited(report)) || awaited(statuses);
  // A refresh that failed after figures were shown: said under them, with the figures kept.
  const stale = (withFigures && report.data && report.error) || (statuses.data && statuses.error);

  return (
    <div className="glance" aria-busy={loading || undefined}>
      {loading && (
        <span className="visually-hidden" role="status">
          Loading {shop.name}'s {withFigures ? "figures" : "tables"}
        </span>
      )}
      {!withFigures ? null : report.data ? (
        <Figures figures={report.data} salesHref={salesHref} shopName={shop.name} />
      ) : report.error ? (
        <Failed what="the figures" onRetry={load} />
      ) : (
        <FiguresPlaceholder />
      )}
      <div className={withFigures ? "glance-footer" : "glance-footer glance-footer-alone"}>
        {statuses.data ? (
          <Tables needs={needsOf(statuses.data, shop.deletedTables)} tablesHref={tablesHref} shopName={shop.name} />
        ) : statuses.error ? (
          <Failed what="the tables" onRetry={load} />
        ) : (
          <span className="placeholder-glow" aria-hidden="true">
            <span className="placeholder col-8" />
          </span>
        )}
        {updatedAt && (
          <span className="glance-updated">
            {stale ? (
              <>
                Couldn't refresh.{" "}
                <Button variant="link" size="sm" className="p-0 align-baseline" onClick={load}>
                  Try again
                </Button>
              </>
            ) : (
              <>Updated {timeOf(updatedAt)}</>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

// The two reports the figures are read from.
interface FiguresData {
  week: ISalesReport;
  today: ISalesReport;
}

const Figures = ({ figures, salesHref, shopName }: { figures: FiguresData; salesHref: string; shopName: string }) => {
  const glance = glanceOf(figures.week, figures.today);
  const { change } = glance.week;
  const tone = !change ? "same" : change.direction === "same" ? "same" : change.direction === "up" ? "good" : "bad";
  return (
    <Link className="glance-figures-link" to={salesHref}>
      <span className="visually-hidden">Sales report for {shopName}:</span>{" "}
      <dl className="glance-figures">
        <div>
          <dt>Net sales today</dt>
          <dd>
            {glance.today.orders === 0 ? (
              // A day not started yet leads with words, not a bold zero.
              <span className="glance-note">no orders yet</span>
            ) : (
              <>
                <span className="glance-value">{formatPrice(glance.today.net)}</span>
                <span className="glance-note">{`${formatCount(glance.today.orders)} ${glance.today.orders === 1 ? "order" : "orders"}`}</span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Net sales, last 7 days</dt>
          <dd>
            <span className="glance-value">{formatPrice(glance.week.net)}</span>
            {change ? (
              <span className={`glance-note glance-delta ${tone}`}>
                {arrowOf(change.direction) && <span aria-hidden="true">{arrowOf(change.direction)} </span>}
                <span className="visually-hidden">{change.direction === "same" ? "" : `${change.direction} `}</span>
                {change.text} vs the week before
              </span>
            ) : (
              <span className="glance-note">new</span>
            )}
          </dd>
        </div>
        <div className="glance-wide">
          <dt>Best seller</dt>
          <dd>
            {glance.bestSeller ? (
              <>
                <span className="glance-name">{glance.bestSeller.name}</span>
                <span className="glance-note">
                  {formatPrice(glance.bestSeller.revenue)} · {formatCount(glance.bestSeller.units)} sold
                </span>
              </>
            ) : (
              <span className="glance-note">nothing sold this week</span>
            )}
          </dd>
        </div>
      </dl>
      {glance.highlight && <p className="glance-highlight">{glance.highlight}</p>}
      <span className="glance-more" aria-hidden="true">
        Sales report ›
      </span>
    </Link>
  );
};

// What the tables need, as the badges the table cards wear, or all clear.
const Tables = ({ needs, tablesHref, shopName }: { needs: Needs; tablesHref: string; shopName: string }) => {
  const badges: string[] = [];
  if (needs.flagged > 0) badges.push(`${formatCount(needs.flagged)} ${needs.flagged === 1 ? "table needs" : "tables need"} attention`);
  if (needs.owed > 0) badges.push(`${formatPrice(needs.owed)} owed`);
  if (needs.payBacks > 0) badges.push(`${formatCount(needs.payBacks)} ${needs.payBacks === 1 ? "pay-back" : "pay-backs"}`);
  return (
    <p className={`glance-tables ${badges.length > 0 ? "attention" : "clear"}`}>
      <Link to={tablesHref}>
        {badges.length > 0 ? (
          badges.map((text, i) => (
            <Fragment key={text}>
              {i > 0 && " "}
              <span className="badge rounded-pill bg-warning-subtle text-warning-emphasis">{text}</span>
            </Fragment>
          ))
        ) : (
          <span>Tables: all clear</span>
        )}
        {" "}
        <span className="visually-hidden">at {shopName}</span>
      </Link>
    </p>
  );
};

const Failed = ({ what, onRetry }: { what: string; onRetry: () => void }) => (
  <p className="glance-failed">
    Couldn't load {what}.{" "}
    <Button variant="link" size="sm" className="p-0 align-baseline" onClick={onRetry}>
      Try again
    </Button>
  </p>
);

// The figures' shape while they load, hidden from screen readers (the status
// line above says what is happening).
const FiguresPlaceholder = () => (
  <div className="placeholder-glow" aria-hidden="true">
    <dl className="glance-figures">
      {[0, 1].map((i) => (
        <div key={i}>
          <dt>
            <span className="placeholder col-6" />
          </dt>
          <dd>
            <span className="glance-value placeholder col-7" />
          </dd>
        </div>
      ))}
      <div className="glance-wide">
        <dt>
          <span className="placeholder col-4" />
        </dt>
        <dd>
          <span className="placeholder col-9" />
        </dd>
      </div>
    </dl>
  </div>
);

export default ShopGlance;
