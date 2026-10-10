# Manager tools

What a shop manager can do from the app and how each screen does it. Read from `src/components/Dashboard`, `Shops/` and `Tables/`, `src/redux/slices/shopSlice.ts`, `src/lib/tables.ts`, `lib/refundReasons.ts`, `lib/paybacks.ts` and `lib/providers.ts`. The manager routes themselves, with every status and message, are in the [API's OpenAPI document](https://github.com/Nando-C/UnQ-BE/blob/main/docs/api.md) under "Manager: tables" and "Manager: refunds and payments"; what the API does about money is in [its payments.md](https://github.com/Nando-C/UnQ-BE/blob/main/docs/payments.md).

A manager is an account with the `shopMg` role, set in the database, never through the app (the sign-up form's role selector was dead UI and went in 2.0.0). The role swaps the shell: a fixed header with a breadcrumb ("My Shops › First Shop"), the shop's section tabs (Details, Menu, Tables), and the account icon. The tabs follow the scroll (`ShopSectionNav`, `lib/sections.ts`) and move onto a row of their own below 640px.

## My Shops

`Dashboard` for a manager: `GET /shops/me` into the `shops` slice, shown as the same photo-on-top card grid diners see on their home page, so a manager sees their shops the way customers will. "Add Shop" opens the shop editor. The manager's own shops carry their full menus and tables (and the tables they deleted), which the shop page's menu, tables and editors read; the shop page loads them itself when opened directly.

## The shop page

`ShopDetails` loads the shop (`GET /shops/:shopId`) and shows, one after the other: the details card (cover in a 16:9 box kept from the start, bio, opening times, phone, web address), the **menu** with a search box and one row per item, and the **tables** as cards. Content is capped at 60rem so menu rows don't stretch across a desktop. While the shop loads, only its heading and placeholders show, and the page is swapped whole when it arrives, so nothing on screen is pushed down.

### The three editors

`ShopModal`, `ItemModal` and `TableModal` share one shape: a dialog (`fullscreen` below 576px, scrollable, the footer always in view) whose form **starts from the saved record each time it opens**, not from what was typed last time. Saving sends the fields, then the picture if one was picked (`lib/upload.ts`, a multipart `PUT` to the record's image route), then reloads the manager's shops. A picture that fails after the fields saved says so without undoing them: "The changes were saved, but the image wasn't: …". Create remembers the id it made, so pressing Create again after a failed upload saves to that record instead of making a second one; one create at a time, so a double tap sends one.

The API's zod `400` is shown as its `details`, joined. The item editor checks the price is a positive number in whole pence before sending (refunds price each line, so a fraction of a penny wouldn't add up); categories are `food` or `drinks`, as the API's enum; a new item starts available.

**Deleting asks in the dialog's own footer** (`ConfirmFooter`, `lib/useConfirmDelete.ts`), not with the browser's `confirm()`: the question takes focus, says what is lost, and focus returns to the Delete button if it's cancelled or fails. Deleting a shop names its counts: "Delete {name}? This also deletes its 6 menu items and 5 tables, and their QR codes stop working. Its payment history goes too: refunds can then only be made from the payment provider." The API's refusals (a table with an open cart; a shop with money still moving) show as they are.

### The availability switch

Each menu row's switch flips `available` in the store before the `PUT` (`setMenuItemAvailability`), so it moves on the tap; a failed save puts it back with "Couldn't update availability — the switch has been put back." Diners see the item greyed out on their next load or focus.

## Tables

Each table is a card with its name, its **status**, its **QR code**, and buttons to view and edit it.

- **Status** comes from `GET /shops/:shopId/tables/status`, polled every 30 seconds while the page is visible (`lib/useVisiblePolling.ts`; a hidden tab stops asking, and coming back loads at once). A failed poll keeps the last result. The card shows a badge (Free, Ordering, Waiting to pay, Partly paid), the amount owed, and anything that needs a look, always as an icon **with text**: "Sold-out item in the cart", "Selection held over 15 min", "More than one open cart", "Payment awaiting confirmation", "Diner to pay back". The colours are Bootstrap's subtle/emphasis pairs; the words carry the meaning.
- **QR codes** are drawn by `qr-code-styling` from the table's `Qr_Url`, in a dark teal chosen to survive print, dim rooms and red-light readers (the figures are in `SingleTable.tsx`), with the shop's own cover in the middle when it uploaded one. "Print QR codes" prints the tables section alone, three codes to a row at 45mm each, never split across a page (`TableList.css`).
- **Deleted tables** (`IShop.deletedTables`, from `/shops/me`) are listed under the cards while they still matter: a cart closed there in the last day, or something left to do (an open cart, a payment or refund awaiting its provider, a diner to pay back). Each opens its sheet, marked "This table was deleted: it takes no more orders." A table whose sheet was opened stays listed for the visit, so the sheet isn't pulled away and focus returns to its button.

## The table sheet

`TableSheet` is where staff act. It loads `GET /shops/:shopId/tables/:tableId/carts` and refreshes every 20 seconds while open; a failed refresh keeps what's shown with "Couldn't refresh this table. What's shown may be out of date."

It shows, top to bottom: the table's state, owed and paid; **To pay back** (below); each **open cart** (more than one is flagged; the first is the one diners see) with its items (ordered, paid, selected per item), who has **selected** what and for how long (over 15 minutes is flagged), its **payments**, its **log**, and the cart's actions; then the carts **closed in the last 24 hours**, collapsed, each with its payments and log.

### Actions

Every action is a question first, in the sheet's footer (`ConfirmFooter`), in plain words that say what will happen; destructive ones get a danger button. Nothing else in the sheet can be asked while one is being confirmed or sent. The sheet reloads after every action, and the table card refreshes its status.

| Action | Asks | Request |
|---|---|---|
| Release one selection | "Release Ada's selection of 2× Latte? Anyone at the table can then pay for it. Ada will see a note." | `POST …/carts/:cartId/releaseSelection` `{ userId, menuId }` (`userId: null` for a diner whose account is gone) |
| Release all | "Release all N selections on this table? Each diner affected will see a note." | `POST …/releaseSelection` with no body |
| Remove unpaid units | "Remove 2× Latte (unpaid) from the table's cart? Any selections on it are released. The 1 paid stays on record. The table will see a note." | `POST …/removeItem` `{ menuId }` |
| Close table | "Close Table 4? 3 unpaid items will be dropped: 2× Latte, 1× Muffin. Paid items stay on record. The next party at this table starts a new cart." (or "Nothing on it was paid, so the cart will be deleted.") | `POST …/close`; the answer says whether the cart was deleted |
| Merge carts | "Move this cart's unpaid items and selections into the newest cart? Its paid items stay on this one as the record." | `POST …/mergeInto` (only on a cart that isn't the newest) |
| Refund | two steps: pick units per line (a stepper up to what's left, a live total at the prices paid) and a **reason** (a list of seven; "Other" asks what happened, up to 200 characters), then "Refund £4.50 to Ada for 1× Latte? Reason: Wrong item served. Stripe returns it to their card, the items are removed from the table's cart, and Ada will see a note. This can't be undone." | `POST /shops/:shopId/carts/:cartId/refunds` `{ paymentId, lines, reason, reasonNote? }` |
| Retry a refund the provider hasn't confirmed | "Retry the £4.50 refund to Ada for 1× Latte? Stripe is asked first whether it already went through; it's only sent again if it didn't, so it can't be refunded twice." | `POST …/refunds/:refundId/retry` |
| Check a pending payment | "Check Ada's payment of £12.00 with PayPal? If PayPal confirmed it, it's recorded as paid. If PayPal declined it, nothing was taken and its items become unpaid again. Ada will see a note either way." | `POST …/payments/:paymentId/check`; the result reads the answer's `payment.status` |
| Mark a pay-back done | "Mark the £12.00 pay-back to Ada as paid back? Do this once you've paid them back another way." (or handled, or checked) | `POST /shops/:shopId/paybacks/:paybackId/done` `{ as }` |

A `409` means the table isn't as it was shown: the sheet says so in its own words ("The table changed while you were looking: here it is again. Check it before trying again.", or the pay-back's) and reloads. Any other failure shows the API's message.

### Payments and refunds

Each recorded payment shows who, when, what, the amount and its provider's name (`lib/providers.ts`); refunds under it, with their reason. A **pending** payment ("Awaiting PayPal: it took this payment but hasn't confirmed it. The items are held as paid until then.") can only be checked; a **failed** one only seen. "Refund…" appears when the payment is complete, has a provider id, nothing of it is under way, and something is left. Paid units from before payments were recorded (closed splits without a `unitPrice`) show as "Paid, details unavailable", to refund from PayPal's dashboard.

### Pay-backs

Money staff must give a diner another way, because Stripe won't (`lib/paybacks.ts`, from the API's `paybacks`): a refund Stripe refused, or a manager's refund Stripe accepted and then failed. They belong to the table, not a cart (whose cart may be gone), so they head the sheet. The wording names the diner, the amount, the payment's id for Stripe's dashboard, and what to do, with a precedence: a **dispute** first (the diner's bank returns the money: "don't pay them back yourselves", mark **handled**), then one a cart still shows as **paid** (check that payment first, mark **checked**), else pay it back another way (mark **paid back**). Done ones stay for 30 days, small and muted: "Paid back £12.00 to Ada · marked by Sam, 3 Oct 14:05". The table card flags an owed one as "Diner to pay back".

### The log

Each cart's `managerLog`, newest first: what managers did ("Refunded", "Released selections", "Closed the table"…) and what the server did about card payments ("Card payment finished", "Refunded by Stripe"). A line staff must act on, a card refund Stripe won't make (`stripeRefundFailed`, shown as "Action needed"), is marked, and flags the closed carts it's under with "Needs staff".
