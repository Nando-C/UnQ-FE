import { ReactNode, useRef } from "react";
import { useElementWidth } from "../../../lib/useElementWidth";

// Pieces every chart on the page shares: the tooltip's box, the section frame
// with its heading, and the box a chart is drawn into at the width it has.

export const ChartTooltip = ({ children }: { children: ReactNode }) => <div className="chart-tooltip">{children}</div>;

// A page section: its heading, then its charts.
export const Section = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} className="sales-section" aria-labelledby={`${id}-heading`}>
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
