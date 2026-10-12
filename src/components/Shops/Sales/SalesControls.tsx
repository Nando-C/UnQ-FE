import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import {
  DayRange,
  GROUPS,
  PRESETS,
  Day,
  SalesState,
  StepUnit,
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

// The period and how it is read: preset chips with arrows that step the period
// by its own length (This week and This month by whole weeks and months), a
// custom range, the grouping, and the comparison switch. Every change goes
// into the URL (the page's state); kept here are only whether the custom
// dates are open and a typed range the URL can't take yet.
const SalesControls = ({ state, by, today, timeZone, onChange }: SalesControlsProps) => {
  const range: DayRange = { from: state.from, to: state.to };
  const preset = presetOf(range, today);
  const [customOpen, setCustomOpen] = useState(preset === null);
  const [typed, setTyped] = useState<DayRange | null>(null);
  const draft = typed ?? range;
  const days = daysBetween(range.from, range.to);
  const compare = state.compare ?? compareDefault(range);
  const unit: StepUnit | undefined = preset === "month" ? "month" : preset === "week" ? "week" : undefined;

  // A new range drops a grouping chosen for the old one, so the default fits again.
  const setRange = (next: DayRange) => onChange({ from: next.from, to: next.to, by: undefined });
  const editDraft = (patch: Partial<DayRange>) => {
    const next = { ...draft, ...patch };
    if (validRange(next)) {
      setTyped(null);
      setRange(next);
    } else setTyped(next);
  };

  return (
    <div className="SalesControls">
      <div className="period">
        <Button variant="outline-secondary" className="step" aria-label="Previous period" onClick={() => setRange(stepRange(range, -1, { today, unit }))}>
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
                setTyped(null);
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
          onClick={() => setRange(stepRange(range, 1, { today, unit }))}
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
          {typed && (
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
        <Form.Select aria-label="Group by" value={by} onChange={(e) => onChange({ by: e.target.value as SalesGroupBy })}>
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
