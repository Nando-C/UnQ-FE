import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import {
  DayRange,
  PRESETS,
  Day,
  SalesState,
  compareDefault,
  daysBetween,
  formatRange,
  presetOf,
  presetRange,
  stepRange,
  validRange,
} from "../../../lib/sales";
import type { SalesGroupBy } from "../../../typings/sales";

interface SalesControlsProps {
  state: SalesState;
  // The grouping in force (the state's, or the default for the range).
  by: SalesGroupBy;
  today: Day;
  timeZone: string;
  onChange: (patch: Partial<SalesState>) => void;
}

const GROUPS: { value: SalesGroupBy; label: string }[] = [
  { value: "day", label: "By day" },
  { value: "week", label: "By week" },
  { value: "month", label: "By month" },
];

// The period and how it is read: preset chips with arrows that step the period
// by its own length, a custom range, the grouping, and the comparison switch.
// Every change goes into the URL (the page's state), nothing is kept here but
// whether the custom dates are open.
const SalesControls = ({ state, by, today, timeZone, onChange }: SalesControlsProps) => {
  const range: DayRange = { from: state.from, to: state.to };
  const preset = presetOf(range, today);
  const [customOpen, setCustomOpen] = useState(preset === null);
  const [draft, setDraft] = useState<DayRange>(range);
  const days = daysBetween(range.from, range.to);
  const compare = state.compare ?? compareDefault(range);

  // A new range drops a grouping chosen for the old one, so the default fits again.
  const setRange = (next: DayRange) => {
    setDraft(next);
    onChange({ from: next.from, to: next.to, by: undefined });
  };
  const editDraft = (patch: Partial<DayRange>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (validRange(next)) onChange({ from: next.from, to: next.to, by: undefined });
  };
  const draftValid = validRange(draft);

  return (
    <div className="SalesControls">
      <div className="period">
        <Button
          variant="outline-secondary"
          className="step"
          aria-label="Previous period"
          onClick={() => setRange(stepRange(range, -1))}
        >
          ‹
        </Button>
        <div className="chips" role="group" aria-label="Period">
          {PRESETS.map(({ key, label }) => (
            <Button
              key={key}
              variant={preset === key ? "primary" : "outline-primary"}
              aria-pressed={preset === key}
              onClick={() => {
                setCustomOpen(false);
                setRange(presetRange(key, today));
              }}
            >
              {label}
            </Button>
          ))}
          <Button
            variant={preset === null ? "primary" : "outline-primary"}
            aria-pressed={preset === null}
            aria-expanded={customOpen}
            onClick={() => setCustomOpen((open) => !open)}
          >
            Custom…
          </Button>
        </div>
        <Button
          variant="outline-secondary"
          className="step"
          aria-label="Next period"
          disabled={range.to >= today}
          onClick={() => setRange(stepRange(range, 1))}
        >
          ›
        </Button>
      </div>
      {customOpen && (
        <div className="custom-range">
          <Form.Group controlId="sales-from" className="form-group d-flex align-items-center gap-2">
            <Form.Label className="mb-0">From</Form.Label>
            <Form.Control type="date" value={draft.from} max={draft.to} onChange={(e) => editDraft({ from: e.target.value })} />
          </Form.Group>
          <Form.Group controlId="sales-to" className="form-group d-flex align-items-center gap-2">
            <Form.Label className="mb-0">To</Form.Label>
            <Form.Control type="date" value={draft.to} min={draft.from} onChange={(e) => editDraft({ to: e.target.value })} />
          </Form.Group>
          {!draftValid && (
            <span className="text-danger small align-self-center" role="alert">
              Two days in order, at most a year apart
            </span>
          )}
        </div>
      )}
      <div className="view-line">
        <p className="summary">
          {formatRange(range)} · {days === 1 ? "1 day" : `${days} days`} · days in {timeZone}
        </p>
        <Form.Select
          aria-label="Group by"
          value={by}
          onChange={(e) => onChange({ by: e.target.value as SalesGroupBy })}
        >
          {GROUPS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Form.Select>
        <Form.Check
          type="switch"
          id="sales-compare"
          label={`Compare with the ${days === 1 ? "day" : `${days} days`} before`}
          checked={compare}
          onChange={(e) => onChange({ compare: e.target.checked })}
        />
      </div>
    </div>
  );
};

export default SalesControls;
