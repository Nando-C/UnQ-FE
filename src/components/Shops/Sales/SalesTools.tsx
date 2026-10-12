import { Button, Dropdown, OverlayTrigger, Popover } from "react-bootstrap";
import { apiUrl } from "../../../backend/backend";
import type { DayRange } from "../../../lib/sales";

// The CSV tables the API exports for a range (GET /shops/:shopId/sales/export).
const TABLES: { key: "orders" | "items" | "days"; label: string; note: string }[] = [
  { key: "orders", label: "Orders", note: "one row per payment" },
  { key: "items", label: "Items", note: "one row per dish" },
  { key: "days", label: "Days", note: "one row per day" },
];

// Beside the controls: how the figures are counted, in the API's own rules,
// and the period's tables as CSV files. The downloads are plain links to the
// export route on the app's own origin, so the session cookie goes with them
// and the browser saves the file the API names.
const SalesTools = ({ shopId, range, timeZone }: { shopId: string; range: DayRange; timeZone: string }) => {
  const route = apiUrl(`/shops/${shopId}/sales/export`);
  const exportUrl = (table: string) => `${route}?${new URLSearchParams({ from: range.from, to: range.to, table })}`;
  const counting = (
    <Popover id="sales-counting" className="counting">
      <Popover.Header as="h3">How these are counted</Popover.Header>
      <Popover.Body>
        <ul>
          <li>
            <strong>Days are the shop's</strong>, in {timeZone}; weeks start on Monday.
          </li>
          <li>
            <strong>Gross</strong> is completed payments by the day paid. A payment the provider still holds is counted apart as awaiting; a failed one not at all.
          </li>
          <li>
            <strong>Refunds</strong> count on the day they were made, whenever the sale was, as at a till. <strong>Net</strong> is gross less refunds; the <strong>refund rate</strong> is refunds over gross.
          </li>
          <li>
            <strong>Orders</strong> are completed payments, <strong>visits</strong> distinct carts, <strong>diners</strong> distinct payers, never named. A <strong>returning</strong> diner had paid here before the period began.
          </li>
          <li>
            <strong>Items</strong> count units sold less units refunded, at the price each sold for, under the name diners saw.
          </li>
          <li>
            The <strong>7-day average</strong> is a reading aid drawn in the page, never a reported figure.
          </li>
        </ul>
      </Popover.Body>
    </Popover>
  );
  return (
    <div className="tools">
      <OverlayTrigger trigger="click" rootClose placement="bottom-start" overlay={counting}>
        <Button variant="link" className="counting-button">
          How these are counted
        </Button>
      </OverlayTrigger>
      <Dropdown>
        <Dropdown.Toggle variant="outline-secondary" id="sales-export">
          Download CSV
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {TABLES.map(({ key, label, note }) => (
            <Dropdown.Item key={key} href={exportUrl(key)}>
              {label} <span className="text-body-secondary">· {note}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
    </div>
  );
};

export default SalesTools;
