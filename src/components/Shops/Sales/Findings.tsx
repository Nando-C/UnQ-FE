import { memo, useMemo } from "react";
import { findings } from "../../../lib/findings";
import { Section } from "./ChartBits";
import type { ISalesReport } from "../../../typings/sales";

// What the figures say, as sentences, each pointing at the chart it came from.
// The rules are in lib/findings.ts; nothing here is a number the API didn't
// give or a ratio of two it did.
const Findings = ({ report }: { report: ISalesReport }) => {
  const found = useMemo(() => findings(report), [report]);
  if (found.length === 0) return null;
  return (
    <Section id="findings" title="Highlights" className="findings">
      <ul>
        {found.map((f) => (
          <li key={f.id}>
            <a href={`#${f.section}`}>{f.text}</a>
          </li>
        ))}
      </ul>
    </Section>
  );
};

export default memo(Findings);
