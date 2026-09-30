import { ReactNode } from "react";
import { Alert, Button } from "react-bootstrap";

// A screen's stand-in while its data loads: placeholders shaped like the real
// content (so nothing jumps when it arrives), hidden from screen readers, which
// hear `label` instead.
export const Loading = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="Loading placeholder-glow">
    <span className="visually-hidden" role="status">
      {label}
    </span>
    <div aria-hidden="true">{children}</div>
  </div>
);

// Shown when data couldn't be loaded and there is nothing older to show.
export const LoadFailed = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <Alert variant="danger" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
    <span>{message}</span>
    <Button variant="outline-danger" onClick={onRetry}>
      Try again
    </Button>
  </Alert>
);

// Under a searched list: says when nothing matches, with a way back to the full
// list. Always mounted (a live region inserted with its text is often not
// announced); empty while something matches.
export const NoMatch = ({
  show,
  what,
  query,
  onClear,
}: {
  show: boolean;
  what: string;
  query: string;
  onClear: () => void;
}) => (
  <div className="NoMatch" role="status">
    {show && (
      <p className="text-body-secondary text-center py-3 mb-0">
        No {what} match “{query.trim()}”.{" "}
        <Button variant="link" className="p-0 align-baseline" onClick={onClear}>
          Clear search
        </Button>
      </p>
    )}
  </div>
);
