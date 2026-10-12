import { RefObject, useLayoutEffect, useState } from "react";

// The width of an element, kept up to date as it resizes, for a chart drawn in
// SVG at a fixed size. Measured before the first paint, so the chart is never
// shown at a guessed width. `fallback` stands in wherever nothing has a size
// (a test's document).
export const useElementWidth = (ref: RefObject<HTMLElement | null>, fallback: number) => {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [ref]);
  return width || fallback;
};
