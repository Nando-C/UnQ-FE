import { useEffect, useRef, useState } from "react";
import { Button, Col, FloatingLabel, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  browseShops,
  selectAllShops,
  selectAllShopsMoreStatus,
  selectAllShopsNext,
  selectAllShopsQuery,
  selectAllShopsStatus,
  selectAllShopsWanted,
} from "../../../redux/slices/shopSlice";
import CustomerShopCard from "../CustomerShopCard/CustomerShopCard";
import ShopCardPlaceholder from "../CustomerShopCard/ShopCardPlaceholder";
import { Loading, LoadFailed, NoMatch } from "../../Common/ScreenStates";

// How long typing pauses before the search is sent.
export const SEARCH_PAUSE_MS = 300;

const AllShopsList = () => {
  const dispatch = useAppDispatch();
  const shopList = useAppSelector(selectAllShops);
  const status = useAppSelector(selectAllShopsStatus);
  // The search the shops shown answer, and the one last asked for.
  const shownQuery = useAppSelector(selectAllShopsQuery) ?? "";
  const wanted = useAppSelector(selectAllShopsWanted);
  const next = useAppSelector(selectAllShopsNext);
  const moreStatus = useAppSelector(selectAllShopsMoreStatus);

  // Back on the page, the search is still the one last made (its shops are
  // held); loaded again only if they aren't, or are a minute old
  // (browseShops decides). Typing sends it after a pause.
  const [query, setQuery] = useState(() => wanted ?? "");
  const q = query.trim();
  const typed = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => dispatch(browseShops({ q })), typed.current ? SEARCH_PAUSE_MS : 0);
    return () => clearTimeout(timer);
  }, [dispatch, q]);

  // Shops already in hand are shown while a refresh or another search runs,
  // and when a refresh of their own search fails, not another search's.
  const showList =
    (shopList.length > 0 || status === "ready") && !(status === "failed" && shownQuery !== wanted);

  return (
    <div className="AllShopsList bg-light pt-5 pb-5">
      <h1 className="visually-hidden">Shops</h1>
      <Row>
        <Col>
          <Form.Group className="search-bar mb-3">
            <FloatingLabel controlId="shop-search" label="Search Shop">
              <Form.Control
                placeholder="Search Shop"
                // The longest search GET /shops/browse takes.
                maxLength={100}
                value={query}
                onChange={(e) => {
                  typed.current = true;
                  setQuery(e.target.value);
                }}
              />
            </FloatingLabel>
          </Form.Group>
        </Col>
      </Row>
      {status === "failed" && (
        <LoadFailed
          message="Couldn't load the shops."
          onRetry={() => dispatch(browseShops({ q: wanted ?? q }))}
        />
      )}
      {/* With nothing to show yet, placeholders stand in. */}
      {showList ? (
        <div className="mb-5">
          {/* One column on phones, two from 768px, three from 1200px. */}
          <ul className="shop-grid list-unstyled mb-0" aria-busy={status === "loading"}>
            {shopList.map((shop) => (
              <li key={shop._id}>
                <Link className="shop-link" to={`/customer/shop/${shop._id}`}>
                  <CustomerShopCard
                    name={shop.name}
                    cover={shop.cover}
                    bio={shop.bio}
                  />
                </Link>
              </li>
            ))}
          </ul>
          <NoMatch
            count={shopList.length}
            what="shops"
            query={shownQuery}
            onClear={() => setQuery("")}
          />
          {/* Not while another search loads: it would page the old one. */}
          {next && wanted === shownQuery && (
            <div className="text-center mt-4">
              {/* Always mounted, so the failure is announced. */}
              <div role="status">
                {moreStatus === "failed" && (
                  <p className="text-danger mb-2">Couldn't load more shops.</p>
                )}
              </div>
              <Button
                variant="outline-primary"
                disabled={moreStatus === "loading"}
                onClick={() => dispatch(browseShops({ q: shownQuery, cursor: next }))}
              >
                {moreStatus === "loading" ? "Loading…" : moreStatus === "failed" ? "Try again" : "Show more"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        status !== "failed" && (
          <Loading label="Loading shops">
            <div className="shop-grid mb-5">
              <ShopCardPlaceholder />
              <ShopCardPlaceholder />
            </div>
          </Loading>
        )
      )}
    </div>
  );
};

export default AllShopsList;
