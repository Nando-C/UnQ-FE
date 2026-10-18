# UX and engineering decisions

Why the client is the way it is. Each entry gives the situation, what was decided, what it cost, and where the decision lives in the code. Dates are when the decision was taken. The API's own decisions are in [UnQ-BE's decisions.md](https://github.com/Nando-C/UnQ-BE/blob/main/docs/decisions.md).

## 2026-08-29: the API is served from the app's own origin

**Context.** The API sets its session cookies `Secure; SameSite=None`, right for a cross-origin API. But the app (Vercel) and the API (Render) are different registrable domains, and Safari's Intelligent Tracking Prevention drops third-party cookies regardless of `SameSite`. Safari users had to turn off cross-site tracking protection to sign in, and the README said so twice. It never showed locally, where everything is `localhost`.

**Decision.** The app calls `/api/…` on its own origin. `vercel.json` rewrites that to the API's host; Vite's dev server proxies it to `DEV_PROXY_TARGET`. The cookies are then first-party everywhere. No API code changed, but two deployment facts became load-bearing: the API's `PUBLIC_API_URL` must be the proxied prefix (`https://un-q.vercel.app/api`), since Google's OAuth callback is built from it and must land where the cookies are readable, and that URL must be registered with Google.

**Consequences.** Safari works with no user intervention. Every environment, tests included, calls a relative `/api`. A wrong `PUBLIC_API_URL` breaks Google sign-in in every browser, so [deployment.md](./deployment.md) spells it out. `vercel.json`, `vite.config.ts`, `.env.example`.

## 2026-07-09, then 2026-10-01: no token ever reaches JavaScript; refresh in one file

**Context.** The API moved access tokens from two weeks to 15 minutes. Without silent refresh, every user would be signed out mid-meal. Storing tokens in JavaScript-readable storage would make the refresh easy and any XSS fatal.

**Decision.** The session stays in HttpOnly cookies the client never reads. One axios response interceptor refreshes on a 401, single-flighted (the API rotates refresh tokens strictly, so two concurrent refreshes would sign the user out), and replays the request once. Later (2026-10-01): a refresh another tab won a moment earlier (`reason: "superseded"`) waits 400 ms for the shared cookies and resends; a refresh that fails for any reason other than the API saying the session is over marks the error `sessionUnknown`, so a dropped connection never signs a manager out.

**Consequences.** All token handling is in `src/backend/backend.ts`, and nowhere else by rule. Sign-in and sign-up are exempt from the refresh (their 401 is a wrong password). A guest's first page load produces a `/users/me` 401 and a refresh 400: inherent to cookie auth, not a defect. `backend.ts`, `userSlice.ts`.

## 2026-07-12, then 2026-10-08: the client never prices anything, and confirms only the amount it showed

**Context.** The 2021 client captured PayPal orders itself, from a total it computed. A price edit between loading and paying, or a tampered request, would charge the wrong amount.

**Decision.** The API creates every payment from database prices and captures it after re-checking the cart; the client relays the provider's approval. For cards (2026-10-08) the payment is created when the diner presses Pay, not when the sheet opens, and Stripe's form is confirmed only if the API's amount equals the one the diner saw, compared in integer pence. A mismatch shows the new total and asks for another press.

**Consequences.** One intent per press, not per opening: nothing to cancel for a sheet only looked at, and every press is checked against the API's prices as they are then. The amount on the Pay button is the diner's own selection, since that is what will be charged. `CardPayment.tsx`, `cartSlice.ts`, `lib/price.ts`.

## 2026-09-22: sold-out items are shown, not hidden, and never payable

**Context.** A live test: a manager marked an item unavailable and a diner in another browser still saw it as normal and added it. The customer side never read `available`.

**Decision.** On the menu a sold-out item stays listed, greyed with a "Sold out" badge, and can't be added. In the kitchen's model an order is only real once paid, so a sold-out item already in a cart **is not payable**: it stays flagged until a diner removes it, is never counted in a total, and blocks checkout until it goes. Nothing is removed automatically; paid units stay paid.

**Consequences.** A diner always understands what happened and never meets an unexplained failure; an "Add" refused as sold out says so and refreshes the menu. The API enforces the same rule, so the UI greys out rather than letting a tap 409. `MenuItem.tsx`, `CartItem.tsx`, `CartListItems.tsx`, `lib/cart.ts` `isSoldOut`.

## 2026-09-25: a teal interface, with the brand kept for the logo

**Context.** The 2021 palette put the logo's coral on buttons and text: 3.01:1 against white, and 14° from the danger red, so "pay" and "delete" read as the same colour, worst for red-blind users.

**Decision.** Two layers kept apart. The brand (coral-to-amber) lives in the logo and artwork only. The interface is an evergreen teal (`#0F6E66`, 6.10:1 on white) for buttons, links, prices and focus rings; red means remove or error only (`#B42318`, 6.57:1); amber is the attention colour in tinted alerts, never as text. Success is always an icon and text, never colour alone. Four options were compared with contrast and colour-blind simulations before choosing.

**Consequences.** Bootstrap is recompiled from source (`styles/theme.scss`), since the compiled stylesheet hardcodes its colours. Navigation highlights the current page in teal; hover is teal only on devices that can hover. `theme.scss`, `NavigationBar.css`, `ShopNavbar.css`.

## 2026-09-27: diners keep the bottom tab bar on desktop, in a phone-width column

**Context.** The customer pages used only `xs` columns, so at 1440px cart rows were 1,300px wide and the checkout sheet ran edge to edge.

**Decision.** The customer app is phone-first (you arrive from a QR code at the table), so on tablets and desktops its pages keep a 40rem column in the middle (`.phone-column`), sheets are 30rem and centred, and the bottom tab bar stays, capped at 20rem and centred, rather than becoming a top bar from 992px. A second navigation layout would add build and test surface for the rare desktop diner.

**Consequences.** One layout to test for diners; the manager app, which is desktop-first, has its own header. `index.css`, `NavigationBar.css`.

## 2026-09-27: split quantities are optimistic

**Context.** Fast taps on + claimed more units than the cart held: the count only moved when the API answered, so every tap in the round trip was sent against the same stale number. A lock that allowed one change at a time fixed the bug and made the stepper feel slow.

**Decision.** A tap sets a wanted count per item and the row shows it at once; a loop per item brings the API round, one request at a time, re-reading the wanted count after each answer so a burst becomes one request for the difference. On failure the wanted count is dropped, the cart refetched, and the row says why. "Select All" is derived from the rows, never stored, so it can't disagree with them.

**Consequences.** Taps feel instant and never race; checkout waits for the loops to settle. The pattern is deliberately confined to selections: everything else waits for the API. `cartSlice.ts` (`setSplitQty`, `syncSplit`), `CartItem.tsx`.

## 2026-09-28, then 2026-09-29: honest checkout messages that stay

**Context.** The first failure sheet said "nothing was charged" for every error, including a 5xx after capture, and auto-closed after three seconds.

**Decision.** A 4xx says nothing was charged, because the API refuses before money moves. A 5xx or no answer never claims either way: the API's own message when it explains itself (it asks to contact staff and gives the id), else a plain "we couldn't confirm your payment — please contact staff before paying again". A card payment the API couldn't confirm is "being confirmed", not failed, and the cart is looked at again. Every outcome stays until the diner closes it (Q4 below), since a success is a money confirmation and a failure may carry the id staff need.

**Consequences.** One mapping for both providers, with every wording in one file, and a table of it in [checkout.md](./checkout.md). `lib/paymentOutcome.ts`, `PaymentFeedback.tsx`.

## 2026-09-30: the UX review's ten questions

A full layout and UX review on 2026-09-29 (26 findings at 375, 768 and 1280px, with a delayed-API pass for loading states) closed in five phases. It left ten product questions, decided on 2026-09-30, each the review's recommended default except Q4:

| # | Question | Decision | Where |
|---|---|---|---|
| Q1 | Should the manager's shop page keep its centred, poster-style section titles, or the My Shops `page-head` pattern? | `page-head`: a left-aligned heading with its actions on the right, on every manager section; about 300px of title margin went at 375px. | `index.css` `.page-head`, `ShopDetails`, `ShopMenu`, `TableList` |
| Q2 | Loading: skeletons or a spinner? | Skeletons shaped like the real cards on the menu, cart, shop list and shop page, where the layout is known, so nothing shifts when data arrives; a spinner only inside dialogs and sheets. | `Common/ScreenStates.tsx`, the `*Placeholder` components |
| Q3 | With no table chosen, should the cart tab be hidden, disabled, or open a hint? | Visible but disabled, with an accessible name ("Cart, choose a table first"); a hint only if diners turn out to be confused. | `NavigationBar.tsx` |
| Q4 | Should payment success auto-close? | No. It stays until dismissed, and closing it goes to the table's menu. The review proposed a "Back to menu" button; decided against, since closing already goes there. | `Cart.tsx` `handleCloseFbk` |
| Q5 | Cart row counter wording (it counts units still free to pick and pay for). | "{n} left to pick", "All picked" at zero, "All claimed by others" when other diners hold them all. "Left to pay" was ambiguous: units I've selected and not paid are also unpaid. | `CartItem.tsx` |
| Q6 | Should the checkout bar stay pinned on phones? | Yes, below 768px, above the tab bar; its measured height joins the scroll padding. | `CartListItems.css` |
| Q7 | Copy style. | Sentence case everywhere: "Log in", "Sign up", "Check out", "Log out", "Total paid" (was "Total Payed"). | throughout |
| Q8 | Should Account show the role? | Hidden for diners; whoever runs shops sees what they are: "Administrator", or by their shops "Owner of Cafe", "Staff at Cafe", "Manages 2 shops", or "Shop manager" with no shop yet (2026-10-17, with membership). | `Account.tsx`, `lib/membership.ts` |
| Q9 | Delete confirmations: name the consequences, or require typing the name? | Name the consequences in the dialog; typing the name is more than this scale needs. | `ShopModal.tsx` `deleteShopMessage` |
| Q10 | "UnQ" or "Un-Q"? | "UnQ", as the logo; the tab title followed, with a title per page. | `lib/usePageTitle.ts` |

## 2026-10-06: the home page pages and searches on the server

**Context.** The bottom bar loaded every shop with its whole menu on every customer page, QR scans included, and the home page searched that in the browser: the cheapest way to make the first screen slow as shops grow.

**Decision.** Only the home page loads shops, 20 at a time from `GET /shops/browse`, with "Show more"; typing searches on the server after a 300 ms pause; older answers are ignored; a search's shops are kept for a minute so coming back to the page doesn't reload them. The shops moved into their own `browse` slice, apart from the manager's.

**Consequences.** The table page after a scan asks for the shop and the cart, nothing more. The home page keeps the shops it has while a refresh runs, and shows a failure only for its own search. `browseSlice.ts`, `AllShopsList.tsx`.

## 2026-10-07, then 2026-10-08: cards through Stripe's Payment Element, inside the sheet, card form first

**Context.** PayPal alone turned away diners without an account; the choice was Stripe's hosted page (a redirect away from the table) or its Payment Element in the sheet.

**Decision.** The Payment Element, in the checkout sheet beside PayPal, cards only, which brings Apple Pay and Google Pay where the device has them. Then the sheet's shape was tried three ways in one day against the live form and real phones: accordion rows (Card, PayPal, none open) made PayPal two taps and PayPal's default funding added a second card button; PayPal first then the card form was tried; what shipped is the **card form first, open, then "or" and PayPal's own button alone**, since Stripe lists Apple Pay as a row under Card and a card is the common case.

**Consequences.** Stripe's React bindings are the one exception to "react-bootstrap only", like PayPal's: a provider's own UI can only come from the provider. Without a publishable key the card option is simply absent and PayPal works as before. `CheckOut.tsx`, `CardPayment.tsx`, `lib/stripe.ts`.

## 2026-09-26: one-row manager header with a breadcrumb and tabs that follow the scroll

**Context.** After a shop page, going back to My Shops still showed the shop's tabs (keyed on the store's last shop); a two-tier header wasted space on desktop.

**Decision.** One row that flows from the left: logo, breadcrumb ("My Shops" or "My Shops › {shop}"), the shop's section tabs, and the account icon pinned right by an auto margin, so what appears never moves what's there. Tabs are keyed on the route, not the store. The current tab follows the scroll position rather than the last click, so it can't go stale. Below 640px the tabs wrap onto their own row; a long shop name scrolls under a finger with fades at the edges rather than being cut, and never moves by itself (WCAG 2.2.2).

**Consequences.** The header's height is measured and published as `--unq-header-h`, which scroll padding, the page's top padding and the scroll-spy all read. `ShopNavbar.tsx`, `ShopName.tsx`, `ShopSectionNav.tsx`, `lib/sections.ts`.

## 2026-09-28: manager actions confirm in the sheet, in plain words

**Context.** Staff actions move items and money for a table of diners; a browser `confirm()` over a dialog can't say much and gives no focus back.

**Decision.** Every action in the table sheet, and every delete in the editors, asks in the dialog's own footer with a message that says exactly what will happen ("3 unpaid items will be dropped: 2× Latte, 1× Muffin. Paid items stay on record."), a danger button for destructive ones, focus moved to the question and returned to the control afterwards. A refund is two steps, with the amount recomputed from the prices paid.

**Consequences.** One `ConfirmFooter` for all of them; the three editors share `useConfirmDelete`. `Common/ConfirmFooter.tsx`, `TableSheet.tsx`, `lib/useConfirmDelete.ts`.

## 2026-09-30 and after: the latest request wins, everywhere a request can overlap

**Context.** A late answer for a shop opened earlier replaced the shop on screen; a `/users/me` failing after a blip signed a manager out; a slow first page of search results overwrote a newer search.

**Decision.** Every fetch that can overlap is numbered and its answer applied only if nothing newer was asked for since, with a failure counting only from the latest request. Each slice states its rule in its reducers.

**Consequences.** Five slightly different implementations of one idea (`shops`, `user`, `browse`, `carts`, and `Cart.tsx`'s table ref), each with its own ordering tests. A shared helper is deferred work in [known-gaps.md](./known-gaps.md). `shopSlice.ts`, `userSlice.ts`, `browseSlice.ts`, `cartSlice.ts`.

## 2026-10-12: the sales page is its own route, drawn with Recharts

**Context.** The manager's shop page is three sections under one scroll. A sales report with a period to choose, a metric to switch and several charts is a page, not a fourth section, and a trend chart with a ghost line, a moving average, an annotated peak and a zoom handle is where hand-drawn SVG stops being cheap. The client had a rule against new UI libraries, amended once for the payment providers' own forms.

**Decision.** A fourth header tab, Sales, at `/shop/:shopId/sales`, loaded as a chunk of its own so diners never download it. The chart is drawn with Recharts: React components rendering SVG, so it takes the theme's colours through CSS variables, renders in the test environment, prints, and has a keyboard-reachable tooltip layer. The rule is amended for charting as it was for payments: a kind of UI react-bootstrap doesn't have. Every number on the page comes from the API's one answer; the page derives only ratios (an average order, a refund rate) and the 7-day average, a reading aid that is never a reported figure. The view lives in the URL.

**Consequences.** One palette on every chart (`Sales/colours.ts`): teal for the metric, the dark amber for refunds, grey dashed for the period before, and the logo's coral as the second of a pair (food and drinks, new and returning, PayPal and card). Coral fills only: as a line among teal it read as a warning, so the running share, the returning share and the 7-day average stay grey or in the metric's colour. Coral is the one brand colour that reaches the interface, as chart ink only: 3.01:1 on white clears the 3:1 bar for a graphic, not the 4.5:1 for text, and against teal it stays apart for every kind of colour vision where black did not (ΔE 102; 63 for deuteranopes, 36 for protanopes, against 40 and 44 for black). It stays off controls and off anything meaning bad, since it sits 22 ΔE from the danger red; no pies, no 3D, zero baselines for money and counts, a visually hidden data table behind each chart. A new metric is a client change, not a request. `components/Shops/Sales/`, `lib/sales.ts`.

## 2026-10-12: the highlights are rules, not a model

**Context.** A page of charts asks the reader to find the story. The sales page wanted to tell it: the busiest day, the dish that carries the revenue, why refunds happen. A language model could write such sentences; it would also write plausible ones the figures don't support, cost a request, and need a key.

**Decision.** The highlights are deterministic rules over the report the page already has (`lib/findings.ts`): each answers one question, says nothing when it has too little to draw on (a day for a weekday pattern, two refunds for a cause, nine diners for a repeat share) or when there is no movement to report, and is tested sentence for sentence. At most six show, in a fixed order, each a link to the chart a reader can check it against.

**Consequences.** The highlights are instant, free, and work offline; they are also only as clever as their rules, and say the same thing to every shop with the same shape of figures. A rule is added where a manager would ask the question, with its test and its silence. The menu's quadrants (stars, workhorses, puzzles, sleepers) are the same kind of thing: a reading of units against price, named so the chart needs no legend; true menu engineering needs a cost per dish, which the data doesn't have.

## 2026-10-14: the shop at a glance is figures on the card, not a page of charts

**Context.** The roadmap's "sales dashboard" could have been a fourth manager page: today and the week in charts, best sellers, what is owed. The Sales tab already draws every chart; a manager opening the app in the morning wants to know, for each shop, whether today has started, how the week is going, and whether a table needs them, before deciding where to go.

**Decision.** No new page. Each shop's card on My Shops carries a few figures and one line (`ShopGlance`): today so far, the last seven days with their change on the seven before, the week's best seller, the first highlight the Sales tab would write for that week, and what the tables need right now. Both reads are routes the app already had, the sales report over a fixed range and the tables' status, so the card shows nothing the Sales tab or the tables page can't explain, and each figure links to the page that does. The week is the last seven days, not the calendar week, so the change is like for like on any weekday. The highlight reuses the Sales tab's rules unchanged, so the two never disagree.

**Consequences.** My Shops asks two requests per shop a minute while visible, as the tables page does for one shop; a manager with many shops would want a summary route, which is a later decision. The card's photo and name are its link; the figures under them are a second link, to the Sales tab, and the footer a third, to the tables, so the card is no longer one link; the bio is one line there. A day not started reads "no orders yet" rather than a bold zero, so the eye lands on the week; the highlight skips what the figures already say and names the week. A reading that would need a chart (the busy hours, the refund causes) stays on the Sales tab. `components/Dashboard/ShopGlance.tsx`, `lib/glance.ts`.

## 2026-10-18: who runs a shop is the shop's answer, not the token's

A shop can now have more than one person running it: an owner and managers, added by the owner by email, and an administrator above every shop. The client doesn't read any of that from the sign-in: every signed-in account loads the shops it belongs to, one selector decides the manager shell from those shops or the account's role, and the manager pages wait for the answer before sending anyone home. A member removed loses the shop on their next request, with no new sign-in, and the client never decides what a caller may do on a shop beyond showing the owner's controls: the API refuses, and its refusals show as they are.

Alternatives weighed: a membership claim in the token (stale until the next refresh; the API would have had to read the shop anyway); invitations by email (a mailer, a token, an acceptance page, for a shop that adds a manager once a year). Decided instead that accounts are provisioned down a chain: an administrator creates owners and shops, owners add managers, and an address without an account gets one with a first password the person is told. A row's actions live in a dialog, each asking in the dialog's own footer as every delete here does, rather than on the row, so what follows can be said in full ("They keep their account and lose access to this shop on their next request."). A Viewer role was considered and left out until something needs it.
