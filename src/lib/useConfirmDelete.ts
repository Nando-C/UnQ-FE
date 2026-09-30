import { useRef, useState } from "react";

// A dialog's Delete that asks first (ConfirmFooter, in place of the dialog's
// usual buttons): whether it is asking, whether the delete is running, and the
// Delete button, which focus goes back to when the question closes without
// deleting.
export const useConfirmDelete = (show: boolean) => {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // A question left open when the dialog closed (Esc, the backdrop) is dropped
  // in the render that reopens it, so it never shows, or takes focus, again.
  const [wasShown, setWasShown] = useState(show);
  if (show !== wasShown) {
    setWasShown(show);
    if (show) setConfirming(false);
  }

  // Runs the delete; if it fails, the question goes (onError says why) and
  // the dialog's usual buttons come back.
  const run = async (step: () => Promise<void>, onError: (err: unknown) => void) => {
    setBusy(true);
    try {
      await step();
    } catch (err) {
      onError(err);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return {
    confirming,
    busy,
    buttonRef,
    ask: () => setConfirming(true),
    cancel: () => setConfirming(false),
    run,
  };
};
