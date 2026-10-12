import { useState } from "react";

// A table's sort: which column and which way. A text column starts
// ascending, a figure descending; the same column again turns it round.
export interface Sort<K extends string> {
  key: K;
  desc: boolean;
}
export const useSort = <K extends string>(initial: Sort<K>, textKeys: readonly K[]) => {
  const [sort, setSort] = useState<Sort<K>>(initial);
  const sortBy = (key: K) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !textKeys.includes(key) }));
  return { sort, sortBy };
};
// Compares two rows under a sort: text by locale, figures by value.
export const compareBy =
  <K extends string, R extends Record<K, string | number | null>>({ key, desc }: Sort<K>) =>
  (a: R, b: R) => {
    const x = a[key] ?? "";
    const y = b[key] ?? "";
    return (typeof x === "string" && typeof y === "string" ? x.localeCompare(y) : Number(x) - Number(y)) * (desc ? -1 : 1);
  };
