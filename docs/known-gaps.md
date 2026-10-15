# Known gaps

What the client knowingly doesn't do yet, what it accepts, and what is on the list. An item leaves this page when it ships or is decided against, with the changelog saying which. The API's own page is [UnQ-BE's known-gaps.md](https://github.com/Nando-C/UnQ-BE/blob/main/docs/known-gaps.md).

## Accepted residuals

- **Managers briefly see the diner's bottom bar** while "who am I" loads: `App` picks the shell from the role, unknown until `/users/me` answers. Drawing nothing until then would delay the diner's first screen, so it waits for a design.
- **The cart page asks for the table's cart two or three times on opening** (`Cart`, `CartListItems` and the bottom bar each fetch on mount). Skipping a fetch while one is in flight could hand a post-failure refresh a stale answer; the reducers already drop all but the latest, so it costs requests, not correctness.
- **No live updates.** The cart and menu refresh when the tab regains focus and on each action; a tab left in the foreground sees other diners' changes on its next action, or the "just sold out" message when an add is refused. The focus refetch also fires on every return from PayPal's popup.
- **Editing a shop, item or table reloads every owned shop** (`GET /shops/me`) though the API answers with the changed record; the availability switch is the one place the store is patched from the click.
- **PayPal's capture has no table guard** while the card's does: a PayPal capture's cart is taken whatever table is on screen. The popup keeps the diner on the page, so the cart on screen is the one being paid; a guard matching the card path is deferred (item 6).
- **Each menu card subscribes to the whole shop**, and each menu row and table card mounts its own hidden editor or sheet; fine at a menu's size.
- **Managers see one open cart as "the one diners see"**; a duplicate is flagged and can be merged, not prevented here.
- **The audit can time out under heavy machine load** on screens a change didn't touch; rerun those before believing a failure.

## Open bugs

- **Six API refusals are told apart by their English wording** (`lib/paymentOutcome.ts`, `cartSlice.ts`, `CartItem.tsx`, `MenuItem.tsx`: "your payment was refunded", "this table's cart is no longer here", "contact staff", "(payment ", "This item is sold out", "Someone at the table is paying for those"). Rewording any of them on the API silently changes what a diner is told, from "refunded" to "nothing was charged" in the worst case. Fix: reason codes, deferred item 1 below, which needs the API to send them first.

## Deferred

Each changes behaviour, a contract or several layers at once, so each is a step of its own.

1. **Read reason codes, not English.** Once the API adds an additive `reason` to every matched 409 and 5xx, `rejection.reason` replaces every `.includes` and the markers go. The API already sends `STILL_CONFIRMING`, `CART_GONE`, `CART_GONE_PENDING` and `superseded`, and the client reads them first.
2. **One "latest request wins" helper** for the five implementations (`shops`, `user`, `browse`, `carts`, `Cart.tsx`'s table ref), or RTK Query.
3. **`decreaseSplit` sends one request per unit** to lower a selection by several; an additive `qty` on the API's `decreaseSplitItem` makes it one, as the add path is.
4. **Fetch the cart once on opening**, in `Cart` only, with a design for the post-failure refresh.
5. **Patch the store from the editors' answers** instead of reloading every shop.
6. **Unify the two capture reducers** in `takeCapturedCart`, giving PayPal's capture the table guard the card's has, with the slice contract and `checkout.test.ts` changed together.
7. **Express Checkout Element**: Apple Pay and Google Pay as one-tap buttons at the top of the sheet, instead of rows inside Stripe's form.
8. Smaller: a shared `EditorFooter` for the three editors' identical footers; test fixture builders (`menu`, `cartWith`, `shopWith`, `renderCart`) redefined across many files moved into `tests/helpers.tsx`; one editor hoisted per list instead of one per row; `TableSheet` reloading carts and status after an action though each manager endpoint answers with the cart.

## Roadmap

In the order decided with the product roadmap, now that the sales report page and the shop at a glance on My Shops are in: **staff on a shop** (inviting and removing members; today a shop's only member is the manager who created it) and then **staff roles** narrowing what each member sees and can press; **kitchen** screens (queue, prep states, live push, which also brings live updates to diners).
