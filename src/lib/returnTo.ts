// Where to take a diner back to once they've signed in or signed up: the table
// they were ordering at. Kept in sessionStorage (this tab only), because
// signing up reloads the page and Google sign-in leaves the site and comes back
// to its root, and Redux loses the table either way. Forgotten after half an
// hour, so an abandoned sign-in doesn't send someone back much later.
const KEY = "unq.returnTo";
const MAX_AGE_MS = 30 * 60 * 1000;

export const rememberReturnTo = (path: string) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // No storage (private mode, blocked): they land on the shop list instead.
  }
};

const read = (): string | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    // Only a path within this site.
    if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return null;
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS) return null;
    return path;
  } catch {
    return null;
  }
};

// The path, left in place.
export const peekReturnTo = read;

// The path, once: it's forgotten as it's read.
export const takeReturnTo = (): string | null => {
  const path = read();
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
  return path;
};
