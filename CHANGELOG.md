# Changelog

All notable changes to the UnQ front end. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/).

UnQ ships as two repositories that release together. This front end at `x.y.*` needs the [UnQ API](https://github.com/Nando-C/UnQ-BE) at `x.y.0` or later; the shared MINOR says which pair belong together. Patches are independent. The MAJOR changes only when a release needs a change on the deployment host or a new API major.

## [Unreleased]

### Added

- **Staff roles on the shop page.** A shop's members hold one of five roles: owner, manager, and below manager till, floor and kitchen. The page shows each member the controls their role may press, from the account's own row on the shop (`lib/roles.ts`, the client's copy of the API's ability table, checked against the document by the contract test): the editors and Add buttons for owners and managers; the table sheet's cart fixes for the till and the floor, its money for the till alone; the Sales tab, the glance's figures and the report for owners and managers; the availability switch and the staff list for everyone. The account page names the role ("Till at Cafe"). In the Staff section, Add staff asks for the role (the owner gives manager, till, floor or kitchen; a manager the three below), and a member's dialog changes their role (`PUT /shops/:shopId/staff/:userId`); the administrator's Accounts page names each role ("Till at Cafe, kitchen at Deli"). Needs the API at 2.4.0 with staff roles (its pull requests #51 and #52).

## [2.4.0] - 2026-10-18

Staff on a shop. Whoever runs a shop gets the manager side: a shop manager or an administrator by role, or a member of a shop, which the account's shops say. The shop page gains a Staff section, where the owner adds managers by email, removes them and hands the shop over, and any member leaves; an administrator sees every shop, names a new shop's owner, and has an Accounts page. Needs the API at 2.4.0. Nothing changes on the host.

### Added

- An Accounts page for an administrator, at `/admin/accounts` and in the header: every account, searched by name or email and by role, twenty at a time, each with its role, the shops it works at and since when. Each row's Manage opens the account's dialog, where the role is saved as it is picked and the account deleted after being told what follows (and that a shop it owns must be handed over or deleted first). New account creates one with a first password and any role. [docs/manager-tools.md](./docs/manager-tools.md#accounts).
- A Staff section on the shop page, after Tables, with a Staff tab in the header: one row per member, the owner first, with their role, since when and who added them. Each row's Manage opens the member's dialog, where the owner (or an administrator) removes a manager or makes them the owner, and any member leaves, each after being told what follows. Add staff, for the owner or an administrator, adds a manager by email: an address with an account is attached as it is, one without gets an account made from a name, surname and first password, and the section says which happened. [docs/manager-tools.md](./docs/manager-tools.md#staff).
- Whoever runs a shop gets the manager side of the app: a shop manager or an administrator by role, or a member of a shop, which the account's shops say. Every signed-in account loads them, the shell and My Shops read them, and the manager pages wait for them before sending anyone to the home page, so a member who opens their shop's address directly isn't bounced while the answer is on its way. The account page says what the account is: "Administrator"; by its shops, "Owner of Cafe", "Staff at Cafe" or "Manages 2 shops"; or, with no shop yet, "Shop manager". A session that turns out to have ended forgets the shops, as signing out does. [docs/architecture.md](./docs/architecture.md#one-app-two-interfaces).
- An administrator sees every shop on My Shops, and the shop editor's Owner field when creating one: a search of the accounts by name or email, whose pick becomes the shop's owner. A member of someone else's shop has no Add Shop. [docs/manager-tools.md](./docs/manager-tools.md#my-shops).
- The types know a shop's `ownerId` and `members`, and an account's `createdBy` and `admin` role; the API contract fixture is the API's document with the Staff and Accounts operations.
- A pull request template, issue templates and a Docs check (`.github/workflows/docs.yml`): a pull request that changes the code without a word in the changelog or the docs fails the check, unless it carries the `no-docs` label. The steps a release follows are written down in [docs/deployment.md](./docs/deployment.md#releasing).

## [2.3.0] - 2026-10-15

Each shop at a glance on My Shops, and the demo's data rewritten every night. Needs the API at 2.3.0. Nothing changes on the host.

### Added

- Each shop's card on My Shops shows the shop at a glance, from the sales report over a fixed week and the tables' status, refreshed every minute while the page is visible: net sales today (with the orders) and over the last seven days against the seven before, the week's best seller with its revenue and units, the first highlight the Sales tab would write that the card doesn't already say, and, as the card's footer, what the tables need right now (tables needing attention, what is owed at the open carts, diners to pay back) or "Tables: all clear", and when the card was last updated. The figures link to the Sales tab on the same week, the footer to the tables. A refresh that fails keeps the figures shown and says so. [docs/manager-tools.md](./docs/manager-tools.md#my-shops).

### Changed

- On My Shops, the shop's photo and name are the link to its page; the figures under them have links of their own, and the bio shows one line.

### Fixed

- A highlight about diners read "Diners is up"; plural metrics now "are", an average "is".

## [2.2.0] - 2026-10-12

Several devices per account, and the sales page: a shop's report over its payments, with highlights, charts and CSV downloads. Needs the API at 2.2.0. Nothing changes on the host.

### Added

- The account page lists the devices the account is signed in on (the API keeps a session per sign-in now, so signing in on a second device no longer signs the first out), each named from its browser and device ("Safari on iPhone"), with its sign-in and last-used dates, this device marked, and a Sign out button for the others. A device signed out there is a guest's within fifteen minutes.

- The Sales tab on a shop's pages, a page of its own at `/shop/:shopId/sales` over the API's sales report: a period picked from a list (Today to Last 90 days, or two dates) and stepped with arrows named for what they step by, today drawn as a bucket still being written, grouped by day, week or month, compared with the period before; headline figures (net sales, orders, average order, refund rate, returning diners) with their change; and a trend chart whose metric switches between nine measures without a request, with the period before as a dashed line (by day), a 7-day average, the peak annotated and a brush to zoom a long range. The view lives in the URL. Days are the shop's own, in its time zone. Charts are drawn with Recharts, in a chunk loaded only when the tab is opened.
- Below the trend, the rest of the report: highlights, up to six sentences computed from the same answer (the biggest mover, the busiest day and hour, the dish or dishes that carry the revenue, the leading refund cause and when refunds cluster, the share of returning diners, the top table, payments still pending), each a link to its chart; a weekday × hour heatmap of orders or sales; the menu as a Pareto with the "n dishes make 80%" marker, a units-against-price scatter sorting dishes into stars, workhorses, puzzles and sleepers, and a sortable table of all items, with a category filter; refunds by cause and by hour; new against returning diners with the returning share and visits per diner; the tables' orders, visits, net and takings per visit; PayPal against card over time. Four more headline figures (gross, refunds, visits, units) behind "More figures".
- Under the sales page's controls, "How these are counted", a note with the counting rules, and "Download CSV", the period's orders, items or days as a file from the API's export route. The shop editor gains the shop's time zone, the one its sales days are counted in, from the browser's list of zones.

### Changed

- The API contract fixture refreshed to the API's current document, with `GET /auth/sessions`, `DELETE /auth/sessions/{sessionId}`, `GET /shops/{shopId}/sales` and `GET /shops/{shopId}/sales/export`.

## [2.1.0] - 2026-10-11

The documentation release: the design knowledge under `docs/`, screenshots from the live demo, the README as a front page, and the API contract fixture refreshed to the API at 2.1.0. Nothing changes on the host.

### Added

- `LICENSE`: MIT, with the licence badge.
- Screenshots of the current build in `docs/images/`, taken from the live demo by `npm run shots` (`scripts/shots.mjs`) and framed in a phone or a browser window; the README and the docs pages use them. The 2021 images are gone.
- `docs/`: the client's design knowledge, read from the code: architecture, checkout (with the table of every outcome a diner can see), manager tools, UX and engineering decisions, responsive layout and accessibility, deployment, testing, known gaps. Linked from the README.
- A contract test: every URL the client calls is an operation in the API's OpenAPI document, kept as a fixture (`scripts/openapi.json`) and refreshed each release with `npm run contract:refresh`.
- A docs test: every link in the Markdown resolves, and the README's environment table matches `.env.example`.

### Changed

- CI runs on pushes to `main` and on pull requests, not on every branch.
- The README is a front page: what it does, Try it with the demo's sign-ins and test cards, what it has to get right, the decisions with their reasons, one diagram, the quick start with where each credential comes from, testing and CI, the docs index, the roadmap. The App Use tour is gone; the docs pages hold the detail. The demo table's QR code in Try it is the one the app draws (`npm run shots -- --shots=qr`), in place of the 2021 image.
- The card form starts on the United Kingdom instead of a country guessed from the diner's address.
- Table cards: three to a row on wide screens instead of four, with side padding for the title and status lines.

### Fixed

- A table's QR code is drawn without the shop's cover when the cover can't be loaded into it (a host without CORS headers), and plain while a slow cover loads, instead of never.
- Deep links on Vercel: a project with its own rewrites gets no single-page fallback, so every path but `/` was a 404 on the live site; a second rewrite sends them to `index.html`.

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

[Unreleased]: https://github.com/Nando-C/UnQ-FE/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/Nando-C/UnQ-FE/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/Nando-C/UnQ-FE/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Nando-C/UnQ-FE/releases/tag/v1.0.0
