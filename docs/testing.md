# Testing

What the suite proves, how it is built, and the gates every change passes. Read from `vite.config.ts` (the `test` block), `src/tests/setup.ts`, `src/tests/server.ts`, `src/tests/helpers.tsx`, `scripts/` and `.github/workflows/ci.yml`.

## The gates

Run separately, each exit code read (never piped through `tail` in an `&&` chain, where the pipe's status replaces the check's):

```bash
npx tsc --noEmit
npm run lint              # ESLint flat config over src/
npm test                  # vitest run
npm run build             # tsc --noEmit && vite build
npm run audit:responsive  # layout, in headless Chrome; see responsive-and-a11y.md
```

CI (`ci.yml`) runs `npm ci`, lint, the tests and the build on Node 24 for every push to `main` and every pull request. The suite needs no API, no secrets and no browser: msw answers every request.

Habits that caught real slips: work out the expected test total before running (previous total plus added minus removed) and stop if the count differs; for a bug fix, show its test failing without the fix; test anything that overlaps or arrives late in one table of every ordering; update the tests that assert old wording in the same change as the wording.

## How the suite is built

**Vitest 5 + React Testing Library + msw 3**, in jsdom, pinned to `http://localhost:3000/` so the API at `/api` is same-origin, as in production. `vite.config.ts` fixes the environment for every run (`VITE_BE_URL=/api`, PayPal's `sb` id, no Stripe key), so a developer's `.env` never changes a test's path; the card suites set the key themselves. Timeouts are 20 s (a file's first case pays jsdom's start-up, which passed 5 s on a two-core runner).

`setup.ts` makes the rules:

- **An unhandled request fails its test.** msw refuses it and the test ends with "requests no handler answered", so a component can't quietly call something the test didn't expect.
- Default handlers (`server.ts`) keep a guest render quiet: `/users/me` is a 401, the home page's shops are empty, the refresh probe is a 400, as the real API answers a guest.
- jsdom's missing browser APIs are shimmed (`matchMedia`, `ResizeObserver`, `scrollTo`).

`helpers.tsx` gives `renderWithProviders` (real reducers, a `MemoryRouter`, an optional route pattern for `useParams`, a `userEvent` instance), `makeStore` for thunk tests, and `gate`, which holds a request until the test lets it through: how ordering tests make a late answer arrive late.

## What it covers

Forty-four files, grouped by what they prove:

- **Sessions**: the refresh interceptor (refresh and replay, single flight, the `superseded` resend, a read asked again as a guest, `sessionUnknown`); log in, sign up and the account editor with the API's errors; the account's devices list (naming a device from its User-Agent, signing one out, the failures); returning to the table after signing in; the manager route guard.
- **Ordering and the cart**: adding from the menu (a sold-out 409, a changed cart, a closed table); split selection, Select All, −/+ bursts, the optimistic loop's failures and rollbacks; the counters; totals at paid prices; the bin and − with units others hold; sold-out rows and the blocked checkout; notices shown and dismissed.
- **Checkout**: the thunks' answers and rejections; the outcome mapping for every answer in [checkout.md](./checkout.md); the sheet with and without a Stripe key; the card flow with `@stripe/react-stripe-js` mocked (submit before create, the pence rounding, a refetch mid-press, the amount mismatch, a decline in the sheet, a connection error going to capture, the return from a bank check handled once, the rechecks and their cancellation).
- **The manager**: table cards and statuses, the polling stopping when hidden; the sheet's every action's question and request, the 409 reload, the refund picker (amounts, reasons, "Other", the API's field errors), pending payments and checks, pay-backs' wording and marking, the log and "Needs staff"; deleted tables; the editors' save-then-upload and partial failures, the create-once guard, the in-dialog deletes and focus return; the availability switch's rollback.
- **The shop list**: paging, server search, out-of-order answers, failures; the latest-shop-wins rules.
- **The sales page**: today and the presets in the shop's zone, stepping a range (by its length, by whole months), the grouping default, the URL state; the ratios and the moving average; the headline figures and their changes, the trend's hidden table, a metric switched without a request, stepping and regrouping with the requests they send, the default range, the empty, failed and loading states; the Sales tab in the header.
- **Pages**: loading, failed, empty, no-match and not-found states; one `main` and one `h1` and a title per page; the layout stability of placeholders; touch targets and the published bar heights.
- **Units**: `formatPrice`, `availableQty`, the outcome helpers.

Two tests look after the repository rather than the UI:

- **The API contract** (`scripts/contract.test.mjs`): every URL the client calls is an operation in the API's OpenAPI document, kept here as `scripts/openapi.json`. The test holds the list of calls with their methods and checks each against the fixture; it also sweeps the source files that import the axios instance for every path-looking literal, so a new call site must be added to the list and must exist in the document. It checks the fixture's MAJOR.MINOR is this app's. Refresh the fixture from the API about to ship with `npm run contract:refresh` (from a running API's `/openapi.json`, by default `http://localhost:3001`, or a URL or file as its argument). A route the API renames or removes then fails here before it fails at a table.
- **The docs** (`scripts/docs.test.mjs`): every link and anchor in `README.md`, `CHANGELOG.md` and `docs/*.md` resolves, and the README's environment table lists exactly the variables in `.env.example`.

Outside `src/`, `scripts/styleImports.test.mjs` keeps Sass `@import` to the one file Bootstrap needs.

Not a test, but the same tooling: `npm run shots -- --env=<file>` (`scripts/shots.mjs`) signs in to the live demo as its two accounts, drives the screens the README and the docs show, and frames each capture in a phone or a browser window into `docs/images/`. It pays for two items by test card and releases a selection on the way, so the demo is seeded again afterwards.

## What it doesn't cover

PayPal's popup and Stripe's iframe are the providers' (their SDKs are mocked at the component boundary); the Google OAuth round trip; real layout (jsdom has none: the responsive audit renders the real thing); real latency and image weights. A manual pass in test mode with Stripe's test cards and a PayPal sandbox account is part of each release ([deployment.md](./deployment.md)).
