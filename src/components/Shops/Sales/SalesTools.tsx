import { useState } from "react";
import { Button, Dropdown, OverlayTrigger, Popover } from "react-bootstrap";
import backend from "../../../backend/backend";
import { apiErrorMessage, apiStatus } from "../../../lib/errors";
import axios from "axios";
import type { DayRange } from "../../../lib/sales";

// The CSV tables the API exports for a range (GET /shops/:shopId/sales/export).
const TABLES = [
  { key: "orders", label: "Orders", note: "one row per payment" },
  { key: "items", label: "Items", note: "one row per dish" },
  { key: "days", label: "Days", note: "one row per day" },
];

// How long the browser has to start the download before the file's URL goes.
const REVOKE_AFTER_MS = 10_000;

// A file is asked for as a blob, so the API's error answer arrives as a blob
// too: read back as the JSON it is, for its message.
const downloadErrorMessage = async (err: unknown) => {
  if (axios.isAxiosError(err) && err.response && err.response.data instanceof Blob) {
    try {
      const data: unknown = JSON.parse(await err.response.data.text());
      return apiErrorMessage(new axios.AxiosError(undefined, undefined, undefined, undefined, { ...err.response, data }));
    } catch {
      // Not JSON: the status is all there is.
      return `the API answered ${apiStatus(err)}`;
    }
  }
  return apiErrorMessage(err);
};

// The file name the API gives the download, from its Content-Disposition.
const fileNameOf = (disposition: unknown, fallback: string) => {
  const match = typeof disposition === "string" ? /filename=([^;]+)/.exec(disposition) : null;
  return match ? match[1].trim().replaceAll('"', "") : fallback;
};

// Beside the controls: how the figures are counted, in the API's own rules,
// and the period's tables as CSV files. A file is fetched through the app's
// API client, as every request is (so a lapsed session is refreshed the usual
// way), and handed to the browser to save under the name the API gives it.
const SalesTools = ({ shopId, range, timeZone }: { shopId: string; range: DayRange; timeZone: string }) => {
  const [failed, setFailed] = useState("");
  const download = async (table: string) => {
    setFailed("");
    try {
      const { data, headers } = await backend.get<Blob>(`/shops/${shopId}/sales/export`, { params: { from: range.from, to: range.to, table }, responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameOf(headers["content-disposition"], `sales-${range.from}-${range.to}-${table}.csv`);
      a.click();
      // Revoked later: some browsers start the download after the click returns.
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
    } catch (err) {
      setFailed(`Couldn't download the file: ${await downloadErrorMessage(err)}`);
    }
  };
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
            <Dropdown.Item key={key} as="button" type="button" onClick={() => download(key)}>
              {label} <span className="text-body-secondary">· {note}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown>
      {failed && (
        <span className="text-danger small" role="alert">
          {failed}
        </span>
      )}
    </div>
  );
};

export default SalesTools;
