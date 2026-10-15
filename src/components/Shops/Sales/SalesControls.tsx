import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import {
  DayRange,
  GROUPS,
  PRESETS,
  Day,
  PresetKey,
  SalesState,
  StepUnit,
  compareDefault,
  daysBetween,
  formatRange,
  isWholeMonths,
  monthsBetween,
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

const CUSTOM = "custom";

// The period and how it is read: a list of periods (Today to Last 90 days,
// or a custom range typed as two dates), the grouping and the comparison on
// one line; under it the dates on screen between the arrows that step them,
// each arrow saying what it steps by. Every change goes into the URL (the
// page's state); kept here are only whether the custom dates were asked for
// and a typed range the URL can't take yet.
const SalesControls = ({ state, by, today, timeZone, onChange }: SalesControlsProps) => {
  const range: DayRange = { from: state.from, to: state.to };
  const preset = presetOf(range, today);
  const [customChosen, setCustomChosen] = useState(false);
  const custom = preset === null || customChosen;
  const [typed, setTyped] = useState<DayRange | null>(null);
  const draft = typed ?? range;
  const days = daysBetween(range.from, range.to);
  const compare = state.compare ?? compareDefault(range);
  const unit: StepUnit | undefined = preset === "month" || isWholeMonths(range) ? "month" : preset === "week" ? "week" : undefined;
  const months = unit === "month" ? monthsBetween(range.from, range.to) : 0;
  const stepBy = unit === "month" ? (months === 1 ? "month" : `${months} months`) : unit === "week" ? "week" : days === 1 ? "day" : `${days} days`;
  const soFar = range.to >= today ? (days === 1 ? ", so far" : ", today so far") : "";

  // A new range drops a grouping chosen for the old one, so the default fits again.
  const setRange = (next: DayRange) => onChange({ from: next.from, to: next.to, by: undefined });
  const choose = (key: string) => {
    if (key === CUSTOM) return setCustomChosen(true);
    setCustomChosen(false);
    setTyped(null);
    setRange(presetRange(key as PresetKey, today));
  };
  const editDraft = (patch: Partial<DayRange>) => {
    const next = { ...draft, ...patch };
    if (validRange(next)) {
      setTyped(null);
      setRange(next);
    } else setTyped(next);
  };

  return (
    <div className="SalesControls">
      <div className="view-line">
        <Form.Select aria-label="Period" value={custom ? CUSTOM : preset} onChange={(e) => choose(e.target.value)}>
          {PRESETS.map(({ key, label }) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
          <option value={CUSTOM}>Custom range…</option>
        </Form.Select>
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
      <div className="range-nav">
        <Button variant="outline-secondary" className="step" aria-label={`Previous ${stepBy}`} title={`Previous ${stepBy}`} onClick={() => setRange(stepRange(range, -1, { today, unit }))}>
          ‹
        </Button>
        <p className="summary">
          <strong>{formatRange(range)}</strong> · {days === 1 ? "1 day" : `${days} days`}
          {soFar} · days in {timeZone}
        </p>
        <Button
          variant="outline-secondary"
          className="step"
          aria-label={`Next ${stepBy}`}
          title={`Next ${stepBy}`}
          disabled={range.to >= today}
          onClick={() => setRange(stepRange(range, 1, { today, unit }))}
        >
          ›
        </Button>
      </div>
      {custom && (
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
    </div>
  );
};

export default SalesControls;
