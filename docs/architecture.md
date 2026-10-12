# Architecture

How the client is put together: what lives where, how data moves, and the rules that keep it moving in one direction. Read from `src/App.tsx`, `src/backend/backend.ts`, `src/redux/`, `src/lib/` and `vite.config.ts`. The API it talks to is described by the [UnQ API's OpenAPI document](https://github.com/Nando-C/UnQ-BE/blob/main/docs/api.md), served by the API at `/docs`.

## One app, two interfaces

The same bundle serves two people. A **diner** arrives from a table's QR code on a phone, orders into the table's shared cart and pays for the units they picked. A **manager** signs in on a laptop and runs their shops, menus and tables, and watches each table's carts and money. `App.tsx` decides which shell to draw from the signed-in user's role (`shopMg` gets the fixed manager header, everyone else the fixed bottom tab bar), and the routes below are open to both:

| Route | Page | Who |
|---|---|---|
| `/` | `Dashboard`: the diner's searchable shop list, or the manager's My Shops | both |
| `/login`, `/register` | sign in, sign up (`AuthLayout` frames both) | guests |
| `/customer/shop/:shopId` | a shop's menu before a table is chosen (`TableMenu` with the choose-table sheet) | diners |
| `/shops/:shopId/tables/:tableId` | a table's menu, where its QR code leads (`TableMenu`) | diners |
| `/shops/:shopId/tables/:tableId/cart` | the table's cart and checkout (`Cart`) | diners |
| `/shop/:shopId` | the manager's page for one shop (`ShopDetails`, behind `ManagerOnly`) | managers |
| `/myAccount` | the account and the devices it is signed in on, or the sign-in form for a guest (`Account`, `Devices`) | both |
| `*` | `NotFound` | both |

`ManagerOnly` sends a guest to sign in (remembering where to come back to) and a diner to `/`. Until it is known who is signed in, the page renders, since it is nearly always a manager opening it.

## The tree

```
src/
├── index.tsx                 entry: Provider, the theme, index.css
├── App.tsx                   routes, the shell (header or tab bar), skip link, <main>
├── backend/backend.ts        the one axios instance, with the refresh-on-401 interceptor
├── redux/
│   ├── app/                  store, typed hooks (useAppDispatch / useAppSelector)
│   └── slices/               user, shops, browse, carts
├── lib/                      pure helpers and hooks shared by components (below)
├── components/
│   ├── Common/               ManagerOnly, ScreenStates (Loading, LoadFailed, NoMatch…), ConfirmFooter
│   ├── Customers/            TableMenu, MenuItem, Cart, CartListItems, CartItem, CheckOut, CardPayment,
│   │                         PaymentFeedback, CartNotices, NavigationBar, AllShopsList, Account…
│   ├── Shops/                ShopDetails, ShopMenu, Item, ItemModal, ShopModal, ShopNavbar, ShopSectionNav, ShopList
│   ├── Tables/               TableList, SingleTable, TableStatus, TableSheet, TableModal
│   ├── Dashboard/  Login/  Register/  NotFound/
├── styles/theme.scss         Bootstrap recompiled with the UnQ palette
├── index.css                 the app's shared utilities (.hit-44, .stepper, .page-head, .phone-column…)
├── typings/                  cart, menu, shop, tables, user
└── tests/                    the Vitest suite, its msw server and helpers
scripts/                      repository checks and tools, outside the app's type check: the responsive audit
                              (+ fixtures), the API contract fixture (openapi.json) with its test and refresh
                              script, the docs test, the Sass import test, the screenshot tool (shots.mjs)
docs/images/                  the screenshots, from the live demo
```

Every component keeps its stylesheet beside it (`Cart.css` next to `Cart.tsx`). Anything two components share moves up: to `index.css` for styles, to `lib/` for code.

## State: four slices, one store

Redux Toolkit holds what more than one component reads, or what must outlive a page. Components reach it only through the typed hooks in `redux/app/hooks.ts`.

| Slice | Holds | Loaded by |
|---|---|---|
| `user` | the signed-in account and `status`: `idle` → `loading` → `authenticated` or `guest` | `fetchUserData` (`GET /users/me`) on every app start and after sign-in; `logOut` |
| `shops` | the manager's own shops (`data`, from `GET /shops/me`) and the shop whose page is open (`selected`, from `GET /shops/:shopId`), with load statuses | `fetchShopList`, `fetchSingleShop` |
| `browse` | the home page's shops, a page at a time, with the search they answer and the cursor of the next page | `browseShops` (`GET /shops/browse`) |
| `carts` | the table's cart as the API has it, the table the diner is at (`pointers`), the selections asked for but not yet confirmed (`pending`), and the last split error per item | `getTableCart`, the cart thunks, `setSplitQty` |

The slices share one discipline: **the latest request wins**. Every fetch that can overlap another is numbered (RTK's `requestId`, or a module counter) and its reducer applies an answer only if nothing newer was asked for since: a shop opened, then another, never shows the first shop's late answer on the second's page; a `/users/me` that fails after a newer one succeeded doesn't sign anyone out; a first page of search results replaces the list only if it is the search last typed. Each slice spells its rule out in its reducers' comments. The same idea, done five slightly different ways, is on the list in [known-gaps.md](./known-gaps.md).

What stays **outside the store**: anything one component owns and nothing else reads. The manager's table sheet loads its table's carts into local state and reloads after every action; the editors (shop, item, table) post and then ask the store to reload the shops; sign-in and sign-up post directly. Those components still send every request through the one axios instance.

## Data flow

```
component ──dispatch(thunk)──▶ slice ──▶ backend (axios) ──▶ /api/… ──proxy──▶ UnQ API
    ▲                            │
    └────── useAppSelector ──────┘
```

- **One axios instance** (`backend/backend.ts`), `baseURL` `VITE_BE_URL` (normally `/api`), `withCredentials: true`. No code holds a token: the session is two HttpOnly cookies the API sets, and the instance just sends them. On a 401 the interceptor refreshes once (`POST /auth/refreshToken`), single-flighted so concurrent 401s share one refresh, and replays the request. A refresh another tab won a moment earlier (`reason: "superseded"`) waits 400 ms for the shared cookies and sends the request again. A refresh the API refuses (400 or 401) ends the session: a read is asked once more as a guest, since a public route then answers the guest view; a write fails. A refresh that fails any other way (no connection, a proxy error) marks the error `sessionUnknown`, so nobody is signed out over a blip. The API side is in [UnQ-BE's auth.md](https://github.com/Nando-C/UnQ-BE/blob/main/docs/auth.md).
- **Errors** are read in one place, `lib/errors.ts`: the API's `{ message, details?, reason? }` body, its status, and `apiErrorMessage`, which prefers the zod `details` of a 400 to its message. Only an object body counts; a proxy's HTML error page is ignored.
- **Cart requests** go through `cartThunk`, which rejects with the API's `{ status, message, reason }` (`CartRejection`) so the UI can tell refusals apart; the checkout's mapping of those is in [checkout.md](./checkout.md).
- **Who is signed in** gates every change. `lib/useSignIn.ts` says whether it's known yet (`/users/me` answered), whether someone is signed in, and sends a guest to `/login` with the current page remembered. A tap made before it is known waits for the answer rather than guessing (`MenuItem`).
- **Coming back after signing in**: `lib/returnTo.ts` keeps the table's path in `sessionStorage` for 30 minutes, because sign-up reloads the page and Google sign-in leaves the site and returns to `/`. `Login`, `Register` and `Dashboard` take it; `ManagerOnly` and `Login` set it.

## Styling layers

1. **The theme** (`styles/theme.scss`): Bootstrap 5 recompiled from source with the UnQ palette. The compiled stylesheet hardcodes its hex values, so this is the only way one `$primary` reaches buttons, links, focus rings and badges alike. The brand (the logo's coral-to-amber gradient) stays in artwork; the interface is teal. Contrast figures are in the file's comments and in [responsive-and-a11y.md](./responsive-and-a11y.md).
2. **Shared utilities** (`index.css`): `.hit-44` (a 44px tap area on a control that looks smaller), `.check-label`, `.bottom-sheet`, `.phone-column` (a 40rem column from 768px), `.stepper`, `.page-head`, `.shop-grid` (1, 2 or 3 columns), the card shadow tokens, the plain list-group rule, the link focus ring, reduced motion.
3. **Component styles**, one file beside each component, for what only it needs.

Three heights are measured at runtime and published as CSS variables on `<html>` (`lib/usePublishedHeight.ts`): `--unq-header-h` (the manager header), `--unq-footer-h` (the diner's tab bar) and `--unq-checkout-h` (the cart's pinned checkout bar on phones). The CSS turns them into scroll padding, so anchors and keyboard focus never land under a fixed bar, and removes them when the bar unmounts.

## Build

- **Vite 8**, React plugin; `npm run build` type-checks first (`tsc --noEmit && vite build`).
- **Chunks**: the libraries every page uses (React, Redux, the router, react-bootstrap, axios, react-icons) are one `vendor` chunk, cached for a year by `vercel.json`'s headers, so a deploy that changes only app code keeps it cached. The card form (`CardPayment`, Stripe's React bindings) is a lazy chunk loaded when the checkout sheet opens with a publishable key set; Stripe.js itself loads then too (`lib/stripe.ts` uses the `pure` entry). PayPal's SDK loads when the sheet opens. The QR code library stays with the manager's table card.
- **Sass**: Bootstrap 5's SCSS uses features Dart Sass 3 deprecates, so its warnings are silenced; our own files are allowed one `@import`, the Bootstrap one in `theme.scss`, which `scripts/styleImports.test.mjs` enforces.
- **Environment**: `VITE_BE_URL`, `VITE_PAYPAL_CLIENT_ID`, `VITE_STRIPE_PUBLISHABLE_KEY` reach the bundle; `DEV_PROXY_TARGET` deliberately has no prefix and only the dev server reads it. See [deployment.md](./deployment.md).
