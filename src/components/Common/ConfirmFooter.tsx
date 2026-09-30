import { ReactNode, useEffect, useRef } from "react";
import { Button, Modal } from "react-bootstrap";

interface ConfirmFooterProps {
  // What will happen, in full: the one chance to say what is lost.
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  // While the step runs: both buttons off, the confirm one saying so.
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  // Where focus goes back to when the question closes (Cancel, or a step that
  // failed): by default the control that asked it. A dialog whose footer is
  // swapped out gives its re-rendered Delete button here instead.
  returnFocus?: () => HTMLElement | null;
}

// A dialog's footer asking to confirm a step, in place of its usual buttons.
// Used instead of the browser's confirm(), which opens over the dialog and
// can't say much. The question takes focus when it appears, so a screen reader
// reads it and the next Tab reaches Cancel; when it closes, focus goes back
// where it came from rather than being dropped on the page.
export const ConfirmFooter = ({
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
  returnFocus,
}: ConfirmFooterProps) => {
  const messageRef = useRef<HTMLParagraphElement>(null);
  // Read when the question closes, so it names the control as it is then.
  const returnFocusRef = useRef(returnFocus);
  returnFocusRef.current = returnFocus;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    messageRef.current?.focus();
    return () => {
      // Runs once the dialog has re-rendered without the question, so the
      // control to return to is on screen again (a step that succeeded may
      // have closed the dialog instead: then there is none).
      const target = returnFocusRef.current ? returnFocusRef.current() : opener;
      if (target?.isConnected) target.focus();
    };
  }, []);

  return (
    <Modal.Footer className="flex-column align-items-stretch">
      <p ref={messageRef} tabIndex={-1} className="mb-2 confirm-message">
        {message}
      </p>
      <div className="d-flex justify-content-end gap-2">
        <Button variant="outline-secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal.Footer>
  );
};
