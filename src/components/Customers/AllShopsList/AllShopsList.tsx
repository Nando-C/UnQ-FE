import { useState } from "react";
import { Col, FloatingLabel, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  fetchAllShops,
  selectAllShops,
  selectAllShopsStatus,
} from "../../../redux/slices/shopSlice";
import CustomerShopCard from "../CustomerShopCard/CustomerShopCard";
import ShopCardPlaceholder from "../CustomerShopCard/ShopCardPlaceholder";
import { Loading, LoadFailed, NoMatch } from "../../Common/ScreenStates";

const AllShopsList = () => {
  const dispatch = useAppDispatch();
  const shopList = useAppSelector(selectAllShops);
  const status = useAppSelector(selectAllShopsStatus);

  const [query, setQuery] = useState("");
  const q = query.toLowerCase();
  const matches = shopList.filter(
    (shop) =>
      shop.name?.toLowerCase().includes(q) ||
      shop.bio?.toLowerCase().includes(q) ||
      shop.menu?.find((m) => m.name?.toLowerCase().includes(q))
  );

  return (
    <div className="AllShopsList bg-light pt-5 pb-5">
      <h1 className="visually-hidden">Shops</h1>
      <Row>
        <Col>
          <Form.Group className="search-bar mb-3">
            <FloatingLabel controlId="shop-search" label="Search Shop">
              <Form.Control
                placeholder="Search Shop"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </FloatingLabel>
          </Form.Group>
        </Col>
      </Row>
      {/* Shops already in hand are shown even while a refresh runs; with none
          yet, placeholders stand in, or a way to try again if loading failed. */}
      {shopList.length > 0 || status === "ready" ? (
        <div className="mb-5">
          {/* One column on phones, two from 768px, three from 1200px. */}
          <ul className="shop-grid list-unstyled mb-0">
            {matches.map((shop) => (
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
            show={!!query.trim() && matches.length === 0}
            what="shops"
            query={query}
            onClear={() => setQuery("")}
          />
        </div>
      ) : status === "failed" ? (
        <LoadFailed
          message="Couldn't load the shops."
          onRetry={() => dispatch(fetchAllShops())}
        />
      ) : (
        <Loading label="Loading shops">
          <div className="shop-grid mb-5">
            <ShopCardPlaceholder />
            <ShopCardPlaceholder />
          </div>
        </Loading>
      )}
    </div>
  );
};

export default AllShopsList;
