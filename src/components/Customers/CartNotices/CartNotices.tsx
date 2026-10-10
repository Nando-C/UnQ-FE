import { useState } from "react";
import { Alert } from "react-bootstrap";
import { ICartNotice } from "../../../typings/cart";

// Notes dismissed on this device, by id. Browser storage is only a convenience
// here: if it's unavailable (private mode, blocked), a dismissed note simply
// comes back on the next visit, until the BE stops sending it (after 2 hours).
const STORAGE_KEY = "unq.dismissedNotices";
const KEEP = 50;

const readDismissed = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

const writeDismissed = (ids: string[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(-KEEP)));
  } catch {
    // Not remembered; see above.
  }
};

// The staff's notes about changes to the diner's table ("The staff released
// your selection of 2× Latte."), above the cart list: the 3 newest the diner
// hasn't dismissed.
const CartNotices = ({ notices }: { notices: ICartNotice[] | undefined }) => {
  const [dismissed, setDismissed] = useState(readDismissed);
  const shown = (notices ?? []).filter((n) => !dismissed.includes(n._id)).slice(0, 3);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    writeDismissed(next);
  };

  // Always there, even empty, so a screen reader announces a note that
  // arrives later. The notes inside are part of this one status region, not
  // alerts of their own.
  return (
    <div className="CartNotices" role="status">
      {shown.map((n) => (
        <Alert
          key={n._id}
          variant="info"
          role={undefined}
          className="mt-2 mb-0 py-2"
          dismissible
          onClose={() => dismiss(n._id)}
        >
          {n.message}
        </Alert>
      ))}
    </div>
  );
};

export default CartNotices;
