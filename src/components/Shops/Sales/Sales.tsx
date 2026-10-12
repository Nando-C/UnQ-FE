import { useCallback, useEffect, useRef, useState } from "react";
import { Container } from "react-bootstrap";
import { useParams, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchSingleShop, selectShopFailed, selectShopFor } from "../../../redux/slices/shopSlice";
import backend from "../../../backend/backend";
import { apiErrorMessage } from "../../../lib/errors";
import { usePageTitle } from "../../../lib/usePageTitle";
import {
  DEFAULT_TIME_ZONE,
  SalesState,
  averageDefault,
  buildSalesSearch,
  compareDefault,
  daysBetween,
  formatRange,
  groupByFor,
  parseSalesSearch,
  todayIn,
} from "../../../lib/sales";
import { HeadingPlaceholder, LoadFailed } from "../../Common/ScreenStates";
import SalesControls from "./SalesControls";
import KpiCards from "./KpiCards";
import TrendChart from "./TrendChart";
import Findings from "./Findings";
import Heatmap from "./Heatmap";
import MenuCharts from "./MenuCharts";
import RefundCharts from "./RefundCharts";
import DinersChart from "./DinersChart";
import TablesAndPayment from "./TablesAndPayment";
import { SalesSkeleton } from "./SalesFallback";
import type { ISalesReport } from "../../../typings/sales";
import "./Sales.css";

// How often the report is asked for again while the period includes today and
// the tab is visible.
const REFRESH_MS = 60_000;

// The manager's sales page for one shop (the Sales tab): the period and how it
// is read live in the URL; one request answers everything on the page, so a
// new metric costs nothing and a new period costs one request. The figures
// that stand stay on screen while a newer answer loads.
const Sales = () => {
  const { shopId = "" } = useParams<{ shopId: string }>();
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(fetchSingleShop(shopId));
  }, [dispatch, shopId]);
  const shop = useAppSelector((state) => selectShopFor(state, shopId));
  const shopFailed = useAppSelector((state) => selectShopFailed(state, shopId));
  usePageTitle(shop ? `Sales · ${shop.name}` : shopFailed ? "Sales" : "");

  // The shop's days: today, and so every preset, depends on its zone.
  const timeZone = shop?.timeZone ?? DEFAULT_TIME_ZONE;
  const today = todayIn(timeZone);
  const [searchParams, setSearchParams] = useSearchParams();
  const state = parseSalesSearch(searchParams, today);
  const range = { from: state.from, to: state.to };
  const by = state.by ?? groupByFor(range);
  const compare = state.compare ?? compareDefault(range);
  const average = state.average ?? averageDefault(by, daysBetween(range.from, range.to));
  const update = (patch: Partial<SalesState>) => setSearchParams(buildSalesSearch({ ...state, ...patch }));

  const [report, setReport] = useState<ISalesReport | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [error, setError] = useState("");
  // The latest request wins: an older answer arriving late never replaces a
  // newer one's figures.
  const requests = useRef(0);
  const { from, to } = range;
  const load = useCallback(async () => {
    const request = ++requests.current;
    setStatus("loading");
    try {
      const { data } = await backend.get<ISalesReport>(`/shops/${shopId}/sales`, {
        params: { from, to, by, ...(compare && { compare: "previous" }) },
      });
      if (request !== requests.current) return;
      setReport(data);
      setStatus("ready");
    } catch (err) {
      if (request !== requests.current) return;
      setError(apiErrorMessage(err));
      setStatus("failed");
    }
  }, [shopId, from, to, by, compare]);

  // Once the shop is known (its zone decides the days). While the period
  // includes today, asked again every minute the tab is visible, and as soon
  // as it becomes visible again.
  const includesToday = to >= today;
  useEffect(() => {
    if (!shop) return;
    load();
    if (!includesToday) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      clearInterval(timer);
      timer = setInterval(load, REFRESH_MS);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        load();
        start();
      } else clearInterval(timer);
    };
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [shop, load, includesToday]);

  // The figures shown are for the request last answered; a report for another
  // shop (the store still holds the page's previous one) is never shown.
  const shown = report && report.range.from === from && report.range.to === to && report.range.by === by ? report : null;
  const stale = report && !shown ? report : null;
  const current = shown ?? stale;
  const empty = current && current.totals.orders === 0 && current.totals.pendingOrders === 0 && current.refunds.count === 0;

  return (
    <Container className="Sales" aria-busy={status === "loading" || undefined}>
      {/* The page's name is known before the shop is, and the controls have
          the same shape whichever shop it is, so both are there from the first
          frame and nothing moves when the shop arrives. */}
      <div className="page-head">
        <h1>Sales</h1>
      </div>
      <p className="text-body-secondary mb-3">
        {shop ? shop.name : shopFailed ? "Shop" : <HeadingPlaceholder />}
      </p>
      {shopFailed && !shop ? (
        <LoadFailed message="Couldn't load this shop." onRetry={() => dispatch(fetchSingleShop(shopId))} />
      ) : (
        <>
          <SalesControls state={state} by={by} today={today} timeZone={timeZone} onChange={update} />
          {status === "failed" && !current && <div className="mt-3"><LoadFailed message={`Couldn't load the sales report: ${error}`} onRetry={load} /></div>}
          {status === "failed" && current && (
            <p className="updating mt-2" role="status">
              Showing the last answer; the latest couldn't be loaded ({error}).
            </p>
          )}
          {status === "loading" && current && (
            <p className="updating mt-2" role="status">
              Updating…
            </p>
          )}
          {current && empty && (
            <p className="mt-4" role="status">
              No sales between {formatRange({ from: current.range.from, to: current.range.to })}.
            </p>
          )}
          {current && !empty && (
            <>
              <KpiCards report={current} />
              <TrendChart
                report={current}
                metricKey={state.metric}
                onMetric={(metric) => update({ metric })}
                average={average}
                onAverage={(on) => update({ average: on })}
              />
              <Findings report={current} />
              <Heatmap report={current} />
              <MenuCharts report={current} />
              <RefundCharts report={current} />
              <DinersChart report={current} />
              <TablesAndPayment report={current} />
            </>
          )}
          {!current && status !== "failed" && <SalesSkeleton />}
        </>
      )}
    </Container>
  );
};

export default Sales;
