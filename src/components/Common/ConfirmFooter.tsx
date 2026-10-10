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
  // failed): the control that asked it. The caller says which, taken when it
  // asked or re-rendered since; by the time this footer mounts the browser
  // may already have moved focus off it (it is disabled while asking).
  returnFocus: () => HTMLElement | null;
}

// A dialog's footer asking to confirm a step, in place of its usual buttons.
// Used instead of the browser's confirm(), which opens over the dialog and
// can't say much. The question takes focus when it appears, so a screen reader
// reads it and the next Tab reaches Cancel; once it is answered, focus goes
// back where it came from rather than being dropped on the page.
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
  // Whether the question was answered (Cancel, or going ahead). Only then does
  // focus go back: a question that goes because its dialog closed or reopened
  // leaves focus to the dialog.
  const answeredRef = useRef(false);
  useEffect(() => {
    messageRef.current?.focus();
    return () => {
      if (!answeredRef.current) return;
      // Runs once the dialog has re-rendered without the question, so the
      // control to return to is on screen again (a step that succeeded may
      // have closed the dialog instead: then there is none).
      const target = returnFocusRef.current();
      if (target?.isConnected) target.focus();
    };
  }, []);

  return (
    <Modal.Footer className="flex-column align-items-stretch">
      <p ref={messageRef} tabIndex={-1} className="mb-2 confirm-message">
        {message}
      </p>
      <div className="d-flex justify-content-end gap-2">
        <Button
          variant="outline-secondary"
          disabled={busy}
          onClick={() => {
            answeredRef.current = true;
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          disabled={busy}
          onClick={() => {
            answeredRef.current = true;
            onConfirm();
          }}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Modal.Footer>
  );
};
