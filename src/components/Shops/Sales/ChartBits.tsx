import { ReactNode, useRef } from "react";
import { Button, OverlayTrigger, Tooltip } from "react-bootstrap";
import { BsInfoCircle } from "react-icons/bs";
import { useElementWidth } from "../../../lib/useElementWidth";
import type { Sort } from "../../../lib/useSort";

// Pieces every chart on the page shares: the tooltip's box, the section frame
// with its heading, the box a chart is drawn into at the width it has, the
// hidden table behind a chart, a row of chips, and a sortable table's header
// (its sort is lib/useSort.ts).

export const ChartTooltip = ({ children }: { children: ReactNode }) => <div className="chart-tooltip">{children}</div>;

// A circled i beside a control or caption: a sentence on hover or focus
// saying what the thing is. `label` names it for a screen reader.
export const Hint = ({ id, label, text }: { id: string; label: string; text: string }) => (
  <OverlayTrigger placement="top" overlay={<Tooltip id={id}>{text}</Tooltip>}>
    <button type="button" className="hint" aria-label={label}>
      <BsInfoCircle aria-hidden="true" />
    </button>
  </OverlayTrigger>
);

// A page section: its heading, then its content.
export const Section = ({ id, title, className = "sales-section", children }: { id: string; title: string; className?: string; children: ReactNode }) => (
  <section id={id} className={className} aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`} className="h5">
      {title}
    </h2>
    {children}
  </section>
);

// Measures the box a chart fills, and draws the chart at that width. `height`
// takes the width, so a chart can keep a ratio within limits.
export const ChartBox = ({
  height,
  fallback = 640,
  children,
}: {
  height: (width: number) => number;
  fallback?: number;
  children: (size: { width: number; height: number }) => ReactNode;
}) => {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, fallback);
  return (
    <div ref={box} aria-hidden="true">
      {children({ width, height: Math.round(height(width)) })}
    </div>
  );
};

// A chart's numbers as a table for a screen reader, hidden as a block around
// the table (a table itself can't shrink to the hidden box).
export const HiddenTable = ({ children }: { children: ReactNode }) => (
  <div className="visually-hidden">
    <table>{children}</table>
  </div>
);

// A row of chips, one pressed.
export const Chips = <T extends string>({
  label,
  options,
  value,
  onChange,
  className = "chips",
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) => (
  <div role="group" aria-label={label} className={className}>
    {options.map((option) => (
      <Button
        key={option.value}
        variant={value === option.value ? "primary" : "outline-primary"}
        aria-pressed={value === option.value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </Button>
    ))}
  </div>
);

export const SortHeader = <K extends string>({
  column,
  label,
  numeric = false,
  sort,
  onSort,
}: {
  column: K;
  label: string;
  numeric?: boolean;
  sort: Sort<K>;
  onSort: (key: K) => void;
}) => (
  <th scope="col" className={numeric ? "text-end" : undefined} aria-sort={sort.key === column ? (sort.desc ? "descending" : "ascending") : undefined}>
    <button type="button" className="sort" onClick={() => onSort(column)}>
      {label}
      {sort.key === column && <span aria-hidden="true">{sort.desc ? " ▾" : " ▴"}</span>}
    </button>
  </th>
);
