# Responsive layout and accessibility

What holds at every size and for every input, and the audit that proves it on each change. Read from `src/index.css`, `src/App.css`, the component stylesheets, `src/components/Common/`, `src/lib/usePublishedHeight.ts` and `scripts/responsive-audit.mjs`.

## Sizes

| Width | What changes |
|---|---|
| 320px | the floor: nothing overflows sideways, prices never split from their symbol (`text-nowrap`), long names wrap inside their column, a cart row's controls drop under its text |
| 576px | editors stop being full-screen dialogs; menu photos grow from 88 to 120px |
| 640px | the manager header's section tabs join the breadcrumb row (below, they get a row of their own) |
| 768px | diners' pages become a centred 40rem column (`.phone-column`); the checkout bar stops being pinned; sheets become 30rem and centred; shop cards go to two columns |
| 1200px | shop cards go to three columns; the manager's shop page is capped at 60rem |

Text at **200%** is a tested size: the bottom bar is three equal flex cells (fixed margins once pushed the account icon off-screen), icons are sized in `em`, and the measured bar heights grow with the text.

The customer app is phone-first; the manager app is desktop-first and gets full-screen dialogs and a compact header on phones. The decision to keep the bottom tab bar on desktop is in [ux-decisions.md](./ux-decisions.md).

## Touch

Every control is at least **44×44px to the finger**, whatever it looks like: `.hit-44` adds an invisible centred `::before` that takes the taps (−/+, bins, every sheet's and dialog's ×); a checkbox sits inside a `<label>` with the same hit area (`.check-label`). The stepper is one outlined control the height of a button, so a filled button beside it reads as the action and the stepper as its setting. The menu's Add is always visible: the 2021 card revealed it on hover, which phones only emulate on a first tap.

Hover styles are gated on `@media (hover: hover)`, because phones apply `:hover` on tap and keep it; a tapped card would otherwise stay lifted and a tapped tab stay teal.

## Fixed bars and measured heights

Three bars are fixed or pinned: the manager header, the diner's bottom tab bar, and on phones the cart's checkout bar above it. Each publishes its measured height as a CSS variable on `<html>` (`--unq-header-h`, `--unq-footer-h`, `--unq-checkout-h`; `lib/usePublishedHeight.ts`, a `ResizeObserver` that writes only when the height changes and removes the variable on unmount). The CSS turns them into `scroll-padding-top` and `scroll-padding-bottom`, so jumping to a section or tabbing to a control scrolls it clear of the bar, and the manager pages pad their top by the header. Until the first measurement lands, `App.css` guesses the usual height in rem so the page doesn't drop.

## Structure every page has

- One `<main id="main">`, and a "Skip to content" link that is the first Tab stop, drawn over the header when focused.
- Exactly one `<h1>`, visually hidden where the design has no title (home, account, log in, sign up).
- A tab title per page (`lib/usePageTitle.ts`): "Menu · UnQ", "Cart · Table 4 · UnQ", "Manage First Shop · UnQ", "Page not found · UnQ".
- Unique ids: every `FloatingLabel` has its own `controlId`, generated with `useId()` in dialogs that mount many times (four forms once shared one id, so only the first field had its label).
- Form fields carry `autoComplete` (`email`, `current-password`, `new-password`, `given-name`, `family-name`).

## Live regions and focus

- A region that will announce something later is **always mounted**, empty until then: a live region inserted together with its text is often not read. The cart's notices, a row's error, the menu card's "Add" error, the "no match" line, the "Show more" failure all follow this.
- Loading placeholders are `aria-hidden` with a visually hidden `role="status"` label ("Loading the menu"); they pulse with Bootstrap's `placeholder-glow`, held still under `prefers-reduced-motion`.
- A confirmation in a dialog's footer takes focus when it appears (so it is read and the next Tab reaches Cancel) and gives focus back to the control that asked when it closes (`ConfirmFooter`). A deleted table whose sheet was opened stays listed so focus can return to its button.
- Icon-only buttons are named: "Edit profile", "Edit table 4", "Remove Latte from the cart", "Release Ada's selection of 2× Latte", "Refund items from Ada's payment of £12.00".
- The availability switch is `role="switch"` with an `aria-label`, so it is announced on/off, not checked.
- Meaning never rides on colour alone: a table's state badge carries its word, attention items an icon and text, success an icon and text.

## Colour

From `styles/theme.scss` (WCAG 2 ratios against white): primary teal `#0F6E66` 6.10:1 as text and under white labels (7.62:1 and 8.29:1 on hover and press); danger `#B42318` 6.57:1 (Bootstrap's default is 4.53:1); success `#15803D` 5.02:1; amber `#FFB627` only as a tinted alert background, never as text (1.75:1). Danger and primary are 95 ΔE apart (53 for deuteranopes, 34 for protanopes), so a bin button beside −/+ never reads as the same kind of button. Sold-out text is grey (`text-body-secondary`), not faded teal, which fell to 2.45:1 under `opacity`. The focus ring on plain links is Bootstrap's teal glow, not the browser's blue.

## Layout shift

Cover photos reserve their space from the start: the menu hero is a 16:9 box capped at 30vh, tinted until the photo arrives; the manager's cover a 16:9 box in its card. Pages that load a heading and a list render only the heading and placeholders, then swap whole, so nothing below is on screen to be pushed down however many lines the name wraps to. The audit fails a screen whose cumulative layout shift while loading is over 0.1.

## Print

"Print QR codes" prints the tables section alone (everything else `visibility: hidden`), three codes to a row whatever the paper width, each canvas 45mm so a 33-module code keeps about 1.3mm per module, never split across a page, with the shop's name as a heading that only prints. Status badges and the sheet are `d-print-none`.

## The audit

`npm run audit:responsive` (`scripts/responsive-audit.mjs`) starts Vite on a free port, mocks `/api/**` in the browser from `scripts/responsive-fixtures.json` (a 45-character shop name, a 45-character dish, a sold-out item, a split cart with a paid unit, five tables, a deleted table), and drives the installed Google Chrome through `playwright-core` (`CHROME_PATH` for another Chromium). It renders **31 screens × 8 viewports**: the diner's home, log in, sign up, a shop without a table, the choose-table sheet, a table's menu, the cart, the checkout sheet, the account and its editor; the manager's My Shops, shop page, shop editor, add item, add table, table sheet, add staff, a member's dialog, refund picker (with and without "Other"), account, and the sales page with a month of figures and with none; the administrator's accounts page, New account, an account's dialog, and a shop page with the administrator's header; a till's My Shops and shop page, and a kitchen's shop page and table sheet. Viewports: 320×640, 360×740, 390×844, a 740×360 landscape phone, 768×1024, 1024×768, 1440×900, and 390px with text at 200%.

It fails (exit 1) on **errors**: anything sticking out sideways past the screen; anything spilling out of the card, sheet or dialog it sits in; a control under 24px (WCAG 2.5.8; links inside a sentence excepted); content or a focused control under a fixed bar (it Tabs through each page, up to 40 stops); an id used twice; a page without exactly one main and one h1; layout shift over 0.1 while loading. It reports **warnings** without failing: controls under 44×32, inline links under 24px, text under 12px, stretched images, a sheet or dialog whose content has to be scrolled, runtime errors.

Options: `--screens=c-menu,c-cart`, `--viewports=320,390-text200`, `--delay=1500` (also screenshots each page while its data loads). The checkout screen shows Stripe's real card form when `.env` has a publishable key (nothing is created until Pay, which the audit never presses), else PayPal's button. It writes `responsive-report/report.md`, `report.json` and a screenshot per screen and viewport (gitignored). A full run takes about five minutes; under heavy machine load it can time out on screens a change didn't touch, so rerun those before treating a timeout as a finding.
