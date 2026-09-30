import { useEffect } from "react";

// The browser tab's title for the page on screen: "Menu · UnQ". Empty while
// the page's own name isn't known yet (a shop still loading) gives "UnQ".
export const usePageTitle = (title: string) => {
  useEffect(() => {
    document.title = title ? `${title} · UnQ` : "UnQ";
  }, [title]);
};
