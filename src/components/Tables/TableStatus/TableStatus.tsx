import { FiAlertTriangle } from "react-icons/fi";
import { ITableStatus } from "../../../typings/tables";
import { ATTENTION_LABEL, STATE_CLASS, STATE_LABEL } from "../../../lib/tables";
import { formatPrice } from "../../../lib/price";

// A table's state for the manager: a badge, what's still owed, and anything that
// needs a look. Screen only (hidden when the QR codes are printed).
const TableStatus = ({ status }: { status: ITableStatus }) => (
  <div className="TableStatus d-print-none">
    <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
      <span className={`badge rounded-pill ${STATE_CLASS[status.state]}`}>
        {STATE_LABEL[status.state]}
      </span>
      {status.owed > 0 && (
        <span className="small">
          Owed <strong className="text-nowrap">{formatPrice(status.owed)}</strong>
        </span>
      )}
    </div>
    {status.attention.map((a) => (
      <div key={a} className="small text-danger-emphasis mt-1">
        <FiAlertTriangle aria-hidden className="me-1 align-text-bottom" />
        {ATTENTION_LABEL[a]}
      </div>
    ))}
  </div>
);

export default TableStatus;
