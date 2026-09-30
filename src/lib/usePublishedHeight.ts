import { RefObject, useEffect } from "react";

// Measures an element's height as it changes (text size, wrapping, viewport)
// and publishes it as a CSS variable on <html>, e.g. --unq-header-h, removed
// when the element goes. The CSS uses these to keep content, anchors and
// keyboard focus clear of fixed and pinned bars.
export const usePublishedHeight = (ref: RefObject<HTMLElement | null>, cssVar: string) => {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty(cssVar, `${el.offsetHeight}px`)
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty(cssVar);
    };
  }, [ref, cssVar]);
};
