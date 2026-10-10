import { useCallback, useEffect, useRef, useState } from "react";

// A value shown for `ms`, then cleared: show(v) replaces it and restarts the
// timer, show(null) clears it now. The timer goes with the component.
export const useFlash = <T,>(ms: number) => {
  const [value, setValue] = useState<T | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timeoutRef.current), []);
  const show = useCallback(
    (next: T | null) => {
      clearTimeout(timeoutRef.current);
      setValue(next);
      if (next !== null) timeoutRef.current = setTimeout(() => setValue(null), ms);
    },
    [ms]
  );
  return [value, show] as const;
};
