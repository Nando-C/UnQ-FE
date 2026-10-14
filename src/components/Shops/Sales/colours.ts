// The colours the charts draw in: the theme's teal for the metric, bad news
// (refunds) in the dark amber, grey for the period before and for the line
// that explains a chart (a running share), and the logo's coral for the second
// of a pair (food and drinks, new and returning, PayPal and card). Coral is a
// fill only: as a line among teal it reads as a warning. Teal and coral stay
// apart for every kind of colour vision, where teal and black did not; coral
// is ink, never text (see index.css).
export const COLOURS = {
  metric: "var(--bs-primary)",
  bad: "var(--bs-warning-text-emphasis)",
  before: "var(--bs-secondary-color)",
  a: "var(--bs-primary)",
  b: "var(--unq-coral)",
  grid: "var(--bs-border-color)",
  text: "var(--bs-body-color)",
};
