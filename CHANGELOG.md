# Changelog

All notable changes to the UnQ front end. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

UnQ ships as two repositories that release together. This front end at `x.y.*` needs the [UnQ API](https://github.com/Nando-C/UnQ-BE) at `x.y.0` or later; the shared MINOR says which pair belong together. Patches are independent. The MAJOR changes only when a release needs a change on the deployment host or a new API major.

## [Unreleased]

### Added

- `docs/`: the client's design knowledge, read from the code: architecture, checkout (with the table of every outcome a diner can see), manager tools, UX and engineering decisions, responsive layout and accessibility, deployment, testing, known gaps. Linked from the README.
- A contract test: every URL the client calls is an operation in the API's OpenAPI document, kept as a fixture (`scripts/openapi.json`) and refreshed each release with `npm run contract:refresh`.
- A docs test: every link in the Markdown resolves, and the README's environment table matches `.env.example`.

## [2.0.0] - 2026-10-09

The rebuild of the 2021 client. Deploying it needs the API at 2.0.0 first, `VITE_BE_URL=/api`, the Vercel output directory set to `dist`, and `VITE_STRIPE_PUBLISHABLE_KEY`: see the README's Deployment.

### Added

- Card payments through Stripe's Payment Element, with Apple Pay and Google Pay where the device has them, beside PayPal. The checkout opens on the card form, then PayPal under "or". The payment is created at Pay and confirmed only when the amount the form showed equals the one the API created.
- Checkout outcomes the API can't answer at once (a closed tab, a bank check) are shown from the table's notices on the next visit.
- Manager table tools: each table's status, its carts, selections, payments and manager log; release, remove, close and merge; cancel and refund paid items with a reason; retry an unclear refund; check a pending payment; mark pay-backs done. Tables deleted in the last day stay listed so their carts can still be refunded.
- Sold-out items shown greyed out with a badge on the menu and in the cart; one that sold out after it was added must be removed before the rest can be paid.
- The home page loads shops a page at a time and searches on the server.
- Split quantities update instantly, sync in the background and roll back on failure.
- Loading, failed, empty, no-match and not-found states on every page; a main landmark, skip link, one h1 and a tab title per page; in-dialog delete confirmations with focus return.
- A responsive audit (`npm run audit:responsive`) that renders the main screens at seven viewports and 200% text in headless Chrome against a mocked API.
- A Vitest + Testing Library + msw suite: 422 tests. ESLint flat config.
- The UnQ icon, wordmark, favicon, touch icon and manifest; printing all of a shop's QR codes as a grid.

### Changed

- Create React App → Vite 8; React 17 → 19; Redux Toolkit 1 → 2; react-router 5 → 7; TypeScript 6. `npm audit` went from 181 findings (11 critical) to 0.
- The API is served from this app's origin (`/api`, rewritten by Vercel and proxied by Vite in development), so the auth cookies are first-party and Safari keeps them.
- Silent token refresh on 401, single-flighted across concurrent requests, and a session another tab refreshed is kept instead of signed out.
- Checkout is server-created and server-captured: the client relays the buyer's approval and never names an amount.
- An accessible teal palette with coral kept for the logo; touch-first controls with 44px targets; layouts that hold from 320px and at 200% text; a phone-width column for diners on wide screens; a manager header with a shop breadcrumb and section tabs.
- Manager forms follow the API's zod contract and show its validation details; menu prices are checked as whole pence before sending.
- `react-paypal-button-v2` replaced by `@paypal/react-paypal-js`.

### Removed

- Create React App boilerplate, the browserslist config, dead code and the unused role selector on sign-up.

### Fixed

- Render-phase dispatch loops, a cart crash on refresh, and spurious cart requests.
- Split selection: the right split item is looked up, Select All derives from the split state, and it is StrictMode-safe.
- Diners return to their own table after signing in; a late answer for a previously opened shop or table is dropped; the latest shop answer always wins.

## [1.0.0] - 2025-03-09

The client as built for the 2021 capstone: the diner's menu and cart with per-item splitting, PayPal checkout, and the manager's shops, menus and tables with QR codes.

[Unreleased]: https://github.com/Nando-C/UnQ-FE/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Nando-C/UnQ-FE/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Nando-C/UnQ-FE/releases/tag/v1.0.0
