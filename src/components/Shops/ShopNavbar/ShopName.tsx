import { useEffect, useRef, useState } from "react";
import { hiddenEdges } from "../../../lib/sections";

interface ShopNameProps {
  name: string;
}

// The shop's name in the header breadcrumb. On a phone a long name can't fit beside
// the logo, My Shops and the account icon, so rather than cut it off it scrolls
// sideways under your finger (or a trackpad), with a fade on whichever edge still has
// text past it. It never scrolls by itself: moving text distracts, and WCAG 2.2.2
// would require a way to pause it. The full name is also in the title (hover), in the
// accessibility tree, and in the page's own heading.
const ShopName = ({ name }: ShopNameProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A different shop starts from the beginning of its own name.
    el.scrollLeft = 0;
    const update = () =>
      setEdges(hiddenEdges(el.scrollLeft, el.scrollWidth, el.clientWidth));
    update();
    el.addEventListener("scroll", update, { passive: true });
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [name]);

  return (
    <span
      ref={ref}
      className="shop-name"
      aria-current="page"
      title={name}
      data-fade-start={edges.start || undefined}
      data-fade-end={edges.end || undefined}
    >
      {name}
    </span>
  );
};

export default ShopName;
