// A device's name from the User-Agent its browser sent at sign-in: the browser
// and the kind of device ("Safari on iPhone", "Chrome on Windows"), enough to
// tell one's own devices apart in the account's list. Not a parser: a few
// known markers in the order they disambiguate (Edge and Chrome both say
// "Chrome"; iPads and Android browsers both say "Safari").
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Firefox\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];
const DEVICES: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Macintosh/, "Mac"],
  [/Windows/, "Windows"],
  [/CrOS/, "Chromebook"],
  [/Linux/, "Linux"],
];
const first = (table: [RegExp, string][], ua: string) => table.find(([re]) => re.test(ua))?.[1];

export const describeDevice = (userAgent?: string): string => {
  if (!userAgent) return "Unknown device";
  const browser = first(BROWSERS, userAgent);
  const device = first(DEVICES, userAgent);
  if (browser && device) return `${browser} on ${device}`;
  return browser ?? device ?? "Unknown device";
};

// "11 Oct 2026": sessions live for weeks, so the year is kept.
export const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
