import { useEffect, useState } from "react";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectSelectedShop } from "../../../redux/slices/shopSlice";
import { activeSection } from "../../../lib/sections";
import "./ShopSectionNav.css";

// The sections of ShopDetails, top to bottom. The ids live on those components.
const SECTIONS = [
  { id: "shopDetails", label: "Details" },
  { id: "shopMenu", label: "Menu" },
  { id: "tableList", label: "Tables" },
];

// A shop's section tabs, in the manager header on that shop's page: beside the
// breadcrumb on wide screens, on a row of their own below 640px (ShopNavbar.css). The
// tab for the section you are reading follows the scroll, so unlike a highlight set on
// click it can't go stale.
const ShopSectionNav = () => {
  const shop = useAppSelector(selectSelectedShop);
  const [current, setCurrent] = useState(SECTIONS[0].id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const header =
        parseFloat(getComputedStyle(root).getPropertyValue("--unq-header-h")) || 0;
      const tops = SECTIONS.map(
        ({ id }) =>
          document.getElementById(id)?.getBoundingClientRect().top ?? Infinity
      );
      // Only once scrolled: a page too short to scroll is "at the bottom" from the
      // start, and would light the last tab on load.
      const atBottom =
        window.scrollY > 0 &&
        window.innerHeight + window.scrollY >= root.scrollHeight - 2;
      setCurrent(SECTIONS[activeSection(tops, header, atBottom)].id);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
    // Re-measure once the shop has loaded and its sections have content.
  }, [shop?._id]);

  return (
    <nav className="ShopSectionNav nav nav-underline" aria-label="Shop sections">
      {SECTIONS.map(({ id, label }) => (
        <a
          key={id}
          className={current === id ? "nav-link active" : "nav-link"}
          href={`#${id}`}
          data-label={label}
          aria-current={current === id ? "location" : undefined}
          // Light it straight away; the scroll that follows agrees.
          onClick={() => setCurrent(id)}
        >
          {label}
        </a>
      ))}
    </nav>
  );
};

export default ShopSectionNav;
