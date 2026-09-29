import { useState } from "react";
import { Col, FloatingLabel, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectAllShops } from "../../../redux/slices/shopSlice";
import CustomerShopCard from "../CustomerShopCard/CustomerShopCard";
import "./AllShopsList.css";

const AllShopsList = () => {
  const shopList = useAppSelector(selectAllShops);

  const [query, setQuery] = useState("");

  return (
    <div className="AllShopsList bg-light pt-5 pb-5">
      <Row>
        <Col>
          <Form.Group className="search-bar mb-3" controlId="formBasicEmail">
            <FloatingLabel controlId="floatingInput" label="Search Shop">
              <Form.Control
                placeholder="Search Shop"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </FloatingLabel>
          </Form.Group>
        </Col>
      </Row>
      {/* One column on phones, two from 768px, three from 1200px. */}
      <ul className="shop-grid list-unstyled mb-5">
        {shopList
          .filter(
            (shop) =>
              shop.name?.toLowerCase().includes(query.toLowerCase()) ||
              shop.bio?.toLowerCase().includes(query.toLowerCase()) ||
              shop.menu?.find((m) =>
                m.name?.toLowerCase().includes(query.toLowerCase())
              )
          )
          .map((shop) => (
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
    </div>
  );
};

export default AllShopsList;
