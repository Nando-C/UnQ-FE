import { useEffect, useRef, useState } from "react";
import { Alert, ListGroup, Row, Button, Form } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  getTableCart,
  selectCartsData,
  selectPendingSplit,
  setSplitQty,
} from "../../../redux/slices/cartSlice";
import { selectUserData } from "../../../redux/slices/userSlice";
import { IItem } from "../../../typings/cart";
import { availableQty, isSoldOut, menuIdOf, myOpenSplit, unpaidQty } from "../../../lib/cart";
import { formatPrice } from "../../../lib/price";
import CartItem from "../CartItem/CartItem";
import CheckOut from "../CheckOut/CheckOut";
import PaymentFeedback, { FeedbackVariant } from "../PaymentFeedback/PaymentFeedback";
import CartNotices from "../CartNotices/CartNotices";
import "./CartListItems.css";
import { tablePath } from "../../../lib/paths";

const CartListItems = () => {
  const { shopId = "", tableId = "" } = useParams<{
    shopId: string;
    tableId: string;
  }>();

  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(getTableCart(tableId));
  }, [dispatch, tableId]);

  // The cart has no live updates, so it refreshes when the diner comes back to
  // this tab (another diner may have claimed units meanwhile). A tab left in
  // the foreground only sees others' changes on its next action.
  useEffect(() => {
    const onFocus = () => dispatch(getTableCart(tableId));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [dispatch, tableId]);

  const cart = useAppSelector(selectCartsData);
  const myUser = useAppSelector(selectUserData);

  const pending = useAppSelector(selectPendingSplit);
  // Changes still on their way to the BE; checkout waits for them.
  const syncing = Object.keys(pending).length > 0;

  const visibleItems = cart.items.filter((i) => unpaidQty(i) > 0);
  // How many units of an item I hold, counting what I've just asked for
  // (setSplitQty) ahead of the BE's answer, as the rows do.
  const myQtyFor = (item: IItem) => {
    const menuId = menuIdOf(item);
    const wanted = menuId ? pending[menuId] : undefined;
    return wanted ?? myOpenSplit(cart.split, myUser._id, menuId)?.qty ?? 0;
  };
  const mySplitFor = (item: IItem) => myQtyFor(item) > 0;

  // An item fully claimed by other diners (nothing left for me, and I hold no
  // split of my own) must not count against "Select All" — otherwise one
  // contested item would make the header permanently un-tickable. Nor must a
  // sold-out one: it can't be selected, and trying would only earn a 409.
  const selectableItems = visibleItems.filter((i) => {
    if (isSoldOut(i)) return false;
    const mine = mySplitFor(i);
    return mine || availableQty(i, cart.split, myUser._id) > 0;
  });

  const soldOutCount = visibleItems.filter(isSoldOut).length;
  // Holding a split on a sold-out item blocks the whole checkout (the BE
  // refuses it), so say so on the button instead of letting PayPal open.
  const holdsSoldOut = visibleItems.some(
    (i) => isSoldOut(i) && mySplitFor(i)
  );

  // "Select All" is derived, never stored: checked exactly when every
  // selectable unpaid item has an open split of mine. Toggling it dispatches
  // per-item commands, so it can never disagree with the individual checkboxes.
  const allSelected =
    selectableItems.length > 0 &&
    selectableItems.every(mySplitFor);

  // Sets every row's wanted count at once; each row's own loop then brings
  // the BE round to it, so a second click before they land just changes the
  // target again instead of claiming everything twice.
  const handleToggleAll = () => {
    for (const item of visibleItems) {
      const menuId = menuIdOf(item);
      if (!menuId) continue;
      const target = { shopId, tableId, cartId: cart._id, menuId };
      if (allSelected) {
        if (mySplitFor(item)) dispatch(setSplitQty({ ...target, qty: 0 }));
      } else if (!mySplitFor(item) && !isSoldOut(item)) {
        // Whatever's still available to me (total minus paid minus other
        // diners' open splits); items I already hold some of are left as they
        // are, and sold-out items are skipped.
        const remaining = availableQty(item, cart.split, myUser._id);
        if (remaining > 0) dispatch(setSplitQty({ ...target, qty: remaining }));
      }
    }
  };

  // What's been paid, at the price each unit was paid at, so a later menu price
  // edit doesn't change it (payments from before the BE recorded prices use
  // today's price).
  const totalSplitPayed = cart.split
    .filter((split) => split.splitStatus === "closed")
    .reduce(
      (total, split) =>
        total + split.qty * (split.unitPrice ?? split.menuId?.price ?? 0),
      0
    );
  // What's still to pay, at today's prices. A sold-out item's unpaid units will
  // never be charged, so they are left out.
  const totalUnpaid = cart.items
    .filter((item) => !isSoldOut(item))
    .reduce(
      (total, item) =>
        total + unpaidQty(item) * (item.menuId?.price ?? 0),
      0
    );
  const totalCart = totalSplitPayed + totalUnpaid;

  // Other diners' open splits as the BE has them, mine as I've asked for them.
  // Open splits on a sold-out item are left out, like its unpaid units.
  const othersSplit = cart.split
    .filter(
      (split) =>
        split.splitStatus === "open" &&
        split.userId !== myUser._id &&
        !isSoldOut(split)
    )
    .reduce((total, split) => total + split.qty * (split.menuId?.price ?? 0), 0);
  const mySplit = cart.items
    .filter((item) => !isSoldOut(item))
    .reduce((total, item) => total + myQtyFor(item) * (item.menuId?.price ?? 0), 0);
  const totalSplit = othersSplit + mySplit;

  const remainingCartTotal = totalUnpaid - totalSplit;

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const navigate = useNavigate();

  // What the payment sheet says, and whether it's open. Kept apart so a closing
  // sheet keeps its content while it slides away.
  const [fbk, setFbk] = useState<{
    variant: FeedbackVariant;
    message?: string;
  } | null>(null);
  const [fbkOpen, setFbkOpen] = useState(false);
  const fbkTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Only a success closes itself (and returns to the table's menu). A failure
  // or a payment under review stays until the diner closes it: it may say not
  // to pay again, or carry the order id staff need.
  const handleShowFbk = (variant: FeedbackVariant, message?: string) => {
    if (fbkTimeoutRef.current) clearTimeout(fbkTimeoutRef.current);
    setFbk({ variant, message });
    setFbkOpen(true);
    if (variant === "success") {
      fbkTimeoutRef.current = setTimeout(() => {
        handleCloseFbk(variant);
      }, 3000);
    }
  };
  const handleCloseFbk = (variant?: FeedbackVariant) => {
    if (fbkTimeoutRef.current) clearTimeout(fbkTimeoutRef.current);
    if ((variant ?? fbk?.variant) === "success") {
      // To the menu by path, not back a page: a diner who signed in on the way
      // here may have other pages behind this one.
      navigate(tablePath(shopId, tableId));
    }
    setFbkOpen(false);
  };

  return (
    <>
      {/* Select All on the left, totals on the right; the totals move under
          it when both don't fit on one line. */}
      <div className="cart-header">
        <label className="check-label hit-44">
          <Form.Check.Input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleAll}
          />
          Select All
        </label>
        <div className="cart-totals">
          <div>
            {remainingCartTotal !== totalCart ? "Remaining cart total" : "Cart total"}{" "}
            <strong className="text-nowrap">
              {formatPrice(remainingCartTotal)}
            </strong>
          </div>
          <div>
            Total paid{" "}
            <strong className="text-nowrap">{formatPrice(totalSplitPayed)}</strong>
          </div>
        </div>
      </div>
      <CartNotices notices={cart.notices} />
      {soldOutCount > 0 && (
        <Alert variant="warning" className="mt-2 mb-1">
          {soldOutCount === 1
            ? "1 item sold out after it was added. It won't be charged — remove it to pay for the rest."
            : `${soldOutCount} items sold out after they were added. They won't be charged — remove them to pay for the rest.`}
        </Alert>
      )}
      <ListGroup className="px-0" variant="flush">
        {visibleItems.map((item) => (
          <ListGroup.Item key={item._id} className="px-0 menu-item">
            <CartItem cartId={cart._id} itemId={item._id} />
          </ListGroup.Item>
        ))}
      </ListGroup>

      <Row className="mx-1 py-5">
        {holdsSoldOut ? (
          <Button disabled className="mb-3">
            Remove sold-out items to check out
          </Button>
        ) : (
          // Only my own selection is charged (the BE totals my open splits), so
          // that's the amount shown, and with nothing selected there's nothing
          // to pay.
          <Button onClick={handleShow} disabled={syncing || mySplit <= 0} className="mb-3">
            Check out <strong>{formatPrice(mySplit)}</strong>
          </Button>
        )}
      </Row>
      <CheckOut
        show={show}
        handleClose={handleClose}
        handleShowFbk={handleShowFbk}
      />
      <PaymentFeedback
        showFbk={fbkOpen}
        variant={fbk?.variant ?? "success"}
        message={fbk?.message}
        handleCloseFbk={() => handleCloseFbk()}
      />
    </>
  );
};

export default CartListItems;
