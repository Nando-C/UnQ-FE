import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Col, Container, Image, Row, Button } from "react-bootstrap";
import { IoArrowBack } from "react-icons/io5";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  getTableCart,
  selectCartLoaded,
  selectCartsData,
  storeCartPointers,
} from "../../../redux/slices/cartSlice";
import {
  fetchSingleShop,
  selectShopFailed,
  selectShopFor,
} from "../../../redux/slices/shopSlice";
import CartListItems from "../CartListItems/CartListItems";
import PaymentFeedback, { FeedbackVariant } from "../PaymentFeedback/PaymentFeedback";
import CartNotices from "../CartNotices/CartNotices";
import CartItemPlaceholder from "../CartItem/CartItemPlaceholder";
import { HeadingPlaceholder, Loading, LoadFailed } from "../../Common/ScreenStates";
import wordmark from "../../../assets/unq-wordmark-onematerial.svg";
import "./Cart.css";
import { tablePath } from "../../../lib/paths";
import { usePageTitle } from "../../../lib/usePageTitle";
import { captureCardPayment } from "../../../lib/paymentOutcome";
import { stripeReturn } from "../../../lib/stripe";
import { selectUserData } from "../../../redux/slices/userSlice";

// When a card payment not settled yet is looked at again (one the BE couldn't
// tell about, or Stripe is still processing; see PaymentOutcome.recheck): by
// then Stripe's webhook or the sweep has usually finished it, and the table's
// cart shows it paid, or a note says how it ended.
const RECHECK_MS = [30_000, 3 * 60_000];

const Cart = () => {
  const dispatch = useAppDispatch();
  const { shopId = "", tableId = "" } = useParams<{
    shopId: string;
    tableId: string;
  }>();

  // The store may hold another shop (opened before); only this one names the
  // table. Once it has loaded, a table it doesn't list shows no name.
  const shop = useAppSelector((state) => selectShopFor(state, shopId));
  const shopFailed = useAppSelector((state) => selectShopFailed(state, shopId));
  const tableName =
    shop?.tables.find((table) => table._id === tableId)?.name ?? "";
  usePageTitle(tableName ? `Cart · Table ${tableName}` : "Cart");

  // Back from a bank check that took the diner away from the page (rare:
  // Stripe.js runs it over the page). The reloaded page has lost the cart, so
  // the return URL names it, and Stripe adds the payment (lib/stripe.ts). Asked
  // once, with that cart (the webhook may have finished the payment and closed
  // it already: the BE then answers with it), and the URL is cleaned at once,
  // so a refresh doesn't ask again.
  const [searchParams, setSearchParams] = useSearchParams();
  const returned = stripeReturn(searchParams);
  const returnedCart = returned?.cartId;
  const returnedPayment = returned?.paymentIntentId;
  // While it's asked, the cart isn't offered for another checkout.
  const [returning, setReturning] = useState(() => !!returnedCart && !!returnedPayment);

  useEffect(() => {
    if (tableId) {
      dispatch(getTableCart(tableId));
    }
  }, [dispatch, tableId]);

  // The bottom bar only links to (and highlights) the cart once it knows the
  // table. TableMenu records it, but a cart page opened directly or refreshed
  // never passes through the menu, so it's recorded here too.
  useEffect(() => {
    dispatch(storeCartPointers({ shopId, tableId }));
  }, [dispatch, shopId, tableId]);

  // Keyed on whether this shop is in hand, not on the object, so a refetch
  // of it elsewhere doesn't start another here.
  const haveShop = !!shop;
  useEffect(() => {
    if (shopId && !haveShop) {
      dispatch(fetchSingleShop(shopId));
    }
  }, [dispatch, shopId, haveShop]);

  const cart = useAppSelector(selectCartsData);
  // Until the BE has answered for this table, an empty cart only means "not
  // loaded yet", so the page shows placeholders rather than "no orders".
  const loaded = useAppSelector(selectCartLoaded);
  const answered = loaded?.tableId === tableId;

  const navigate = useNavigate();
  // The cart is only reached from its table's menu, so Back goes there by
  // path: back a page could land on the sign-in form a diner passed through.
  const goBack = () => {
    navigate(tablePath(shopId, tableId));
  };

  // How a checkout ended, and whether that sheet is open. Kept apart so a
  // closing sheet keeps its content while it slides away. Every outcome stays
  // until the diner closes it: a success is a money confirmation, and a failure
  // may say not to pay again or carry the order id staff need. Closing a
  // success goes on to the table's menu.
  const [fbk, setFbk] = useState<{ variant: FeedbackVariant; message?: string } | null>(null);
  const [fbkOpen, setFbkOpen] = useState(false);
  const userId = useAppSelector(selectUserData)._id;
  // The table whose cart is looked at again after a card payment still being
  // confirmed, and who paid (unknown while their session loads). Moving to
  // another table or signing out stops it, so a late answer never puts one
  // table's cart on another's page.
  // `at`: when it was asked for, so the schedule keeps its times however often
  // it's updated.
  const [recheck, setRecheck] = useState<{ tableId: string; userId: string; at: number } | null>(null);
  if (recheck && (recheck.tableId !== tableId || (recheck.userId && recheck.userId !== userId))) {
    setRecheck(null);
  } else if (recheck && !recheck.userId && userId) {
    // Set on a reloaded page before the session had loaded: whose it is now.
    setRecheck({ ...recheck, userId });
  }
  useEffect(() => {
    if (!recheck) return;
    const timers = RECHECK_MS.map((ms) => ms - (Date.now() - recheck.at))
      .filter((wait) => wait > 0)
      .map((wait) => setTimeout(() => dispatch(getTableCart(recheck.tableId)), wait));
    return () => timers.forEach(clearTimeout);
  }, [recheck, dispatch]);

  const handleShowFbk = useCallback(
    (variant: FeedbackVariant, message?: string, lookAgain?: boolean) => {
      setFbk({ variant, message });
      setFbkOpen(true);
      if (lookAgain) setRecheck({ tableId, userId, at: Date.now() });
    },
    [tableId, userId]
  );

  const returnHandled = useRef(false);
  // The table on screen now: an answer about another one isn't shown here.
  const tableRef = useRef(tableId);
  useEffect(() => {
    tableRef.current = tableId;
  });
  useEffect(() => {
    if (!returnedCart || returnHandled.current) return;
    returnHandled.current = true;
    setSearchParams({}, { replace: true });
    if (!returnedPayment || !tableId) return;
    captureCardPayment(dispatch, { tableId, cartId: returnedCart, paymentIntentId: returnedPayment }).then(
      ({ variant, message, recheck }) => {
        setReturning(false);
        // Left for another table meanwhile: its cart there is told by a
        // note when the diner comes back.
        if (tableRef.current !== tableId) return;
        handleShowFbk(variant, message, recheck);
        // The page reloaded on the way back: the table's cart as it is now.
        dispatch(getTableCart(tableId));
      }
    );
  }, [returnedCart, returnedPayment, tableId, setSearchParams, dispatch, handleShowFbk]);
  const handleCloseFbk = () => {
    // By path, not back a page: see goBack.
    if (fbk?.variant === "success") goBack();
    setFbkOpen(false);
  };

  return (
    <>
      <Container className="Cart phone-column bg-light">
        <Row className="align-items-center pt-3">
          <Col xs={2}>
            <Button variant="link" className="hit-44" onClick={goBack} aria-label="Back">
              <IoArrowBack size={25} />
            </Button>
          </Col>
          {tableId && (
            <Col className="text-center" xs={8}>
              <h1 className="cart-table-name h6 mb-0">
                {tableName ? (
                  <span>Table: {tableName}</span>
                ) : !shop && !shopFailed ? (
                  <HeadingPlaceholder />
                ) : null}
              </h1>
            </Col>
          )}
        </Row>
        {returning ? (
          <Loading label="Checking your card payment">
            <p className="text-center text-body-secondary pt-5">Checking your card payment…</p>
          </Loading>
        ) : cart.items.length > 0 ? (
          <CartListItems handleShowFbk={handleShowFbk} />
        ) : !answered ? (
          <Loading label="Loading the table's cart">
            <div className="d-grid gap-2 pt-5">
              <CartItemPlaceholder />
              <CartItemPlaceholder />
            </div>
          </Loading>
        ) : loaded.failed ? (
          <LoadFailed
            message="Couldn't load this table's cart."
            onRetry={() => dispatch(getTableCart(tableId))}
          />
        ) : (
          <>
            {/* Why the cart is empty, when staff did it ("The staff closed
                this table"): the list, which shows them otherwise, isn't here. */}
            <CartNotices notices={cart.notices} />
            <Card className="text-center">
              <Card.Body className="py-4">
                <Image src={wordmark} alt="" fluid className="mb-4" style={{ maxWidth: "10rem" }} />
                <Card.Title as="h2" className="h5">
                  No open orders
                </Card.Title>
                <Card.Text className="text-body-secondary">
                  Anything added from the menu shows up here.
                </Card.Text>
                <Button onClick={goBack}>Back to the menu</Button>
              </Card.Body>
            </Card>
          </>
        )}
      </Container>
      <PaymentFeedback
        showFbk={fbkOpen}
        variant={fbk?.variant ?? "success"}
        message={fbk?.message}
        handleCloseFbk={handleCloseFbk}
      />
    </>
  );
};

export default Cart;
