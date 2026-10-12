import { findings } from "../../../lib/findings";
import type { ISalesReport } from "../../../typings/sales";

// What the figures say, as sentences, each pointing at the chart it came from.
// The rules are in lib/findings.ts; nothing here is a number the API didn't
// give or a ratio of two it did.
const Findings = ({ report }: { report: ISalesReport }) => {
  const found = findings(report);
  if (found.length === 0) return null;
  return (
    <section className="findings" aria-labelledby="findings-heading">
      <h2 id="findings-heading" className="h5">
        Findings
      </h2>
      <ul>
        {found.map((f) => (
          <li key={f.id}>
            <a href={`#${f.section}`}>{f.text}</a>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default Findings;
