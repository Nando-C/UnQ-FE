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
}

// A dialog's footer asking to confirm a step, in place of its usual buttons.
// Used instead of the browser's confirm(), which opens over the dialog and
// can't say much. The question takes focus when it appears, so a screen reader
// reads it and the next Tab reaches Cancel.
export const ConfirmFooter = ({
  message,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmFooterProps) => {
  const messageRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    messageRef.current?.focus();
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
