import { Container } from "react-bootstrap";
import { Loading } from "../../Common/ScreenStates";
import "./Sales.css";

// What the Sales page shows while its code (a chunk of its own, with the
// charting library) or its first answer loads: the page's shape, in bars.
// Loaded with the app, so the page sits under the header from the first frame.
export const SalesSkeleton = ({ label = "Loading the sales report" }: { label?: string }) => (
  <Loading label={label}>
    <ul className="kpis">
      {[1, 2, 3, 4, 5].map((n) => (
        <li key={n} className="kpi">
          <span className="placeholder col-7 d-block mb-2" />
          <span className="placeholder col-9 placeholder-lg d-block" />
        </li>
      ))}
    </ul>
    <div className="chart">
      <span className="placeholder col-3 d-block mb-3" />
      <div className="placeholder chart-placeholder w-100 d-block" />
    </div>
  </Loading>
);

const SalesFallback = () => (
  <Container className="Sales">
    <div className="page-head">
      <h1>Sales</h1>
    </div>
    <SalesSkeleton label="Loading the sales page" />
  </Container>
);

export default SalesFallback;
