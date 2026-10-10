import { useEffect, useRef } from "react";

// Calls `load` now and then every `ms` while the page is visible, so a
// background tab doesn't keep asking the server. Coming back to the tab loads
// straight away. Nothing runs while `enabled` is false.
export const useVisiblePolling = (load: () => void, ms: number, enabled = true) => {
  // The latest `load`, without restarting the timer each render.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      loadRef.current();
      clearInterval(timer);
      timer = setInterval(() => loadRef.current(), ms);
    };
    const stop = () => clearInterval(timer);
    const onVisibility = () =>
      document.visibilityState === "visible" ? start() : stop();

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
};
