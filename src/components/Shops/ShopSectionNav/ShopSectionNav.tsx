import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

interface ShopSectionNavProps {
  shopId: string;
  // On the shop's Sales page (its own route) rather than its page.
  salesPage: boolean;
}

// A shop's tabs, in the manager header on that shop's pages: beside the breadcrumb on
// wide screens, on a row of their own below 640px (ShopNavbar.css). Three are the shop
// page's sections, and the tab for the one you are reading follows the scroll, so
// unlike a highlight set on click it can't go stale; the fourth, Sales, is a page of
// its own, from which the three lead back to their section.
const ShopSectionNav = ({ shopId, salesPage }: ShopSectionNavProps) => {
  const shop = useAppSelector(selectSelectedShop);
  const [current, setCurrent] = useState(SECTIONS[0].id);

  useEffect(() => {
    if (salesPage) return;
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
  }, [shop?._id, salesPage]);

  return (
    <nav className="ShopSectionNav nav nav-underline" aria-label="Shop sections">
      {SECTIONS.map(({ id, label }) =>
        salesPage ? (
          <Link key={id} className="nav-link" to={`/shop/${shopId}#${id}`} data-label={label}>
            {label}
          </Link>
        ) : (
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
        )
      )}
      <Link
        className={salesPage ? "nav-link active" : "nav-link"}
        to={`/shop/${shopId}/sales`}
        data-label="Sales"
        aria-current={salesPage ? "page" : undefined}
      >
        Sales
      </Link>
    </nav>
  );
};

export default ShopSectionNav;
