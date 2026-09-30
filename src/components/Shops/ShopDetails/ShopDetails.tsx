import "./ShopDetails.css";
import { useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  Card,
  Row,
  Col,
  Button,
  ListGroup,
  Container,
} from "react-bootstrap";
import { FcClock, FcCellPhone, FcAddressBook } from "react-icons/fc";
import { useEffect, useState } from "react";
import ShopModal from "../ShopModal/ShopModal";
import ShopMenu from "../ShopMenu/ShopMenu";
import TableList from "../../Tables/TableList/TableList";
import {
  fetchShopList,
  fetchSingleShop,
  selectSelectedFailed,
  selectSelectedShop,
} from "../../../redux/slices/shopSlice";
import { Loading, LoadFailed } from "../../Common/ScreenStates";
import { usePageTitle } from "../../../lib/usePageTitle";

// The manager's page for one shop: its details, menu and tables, one after
// the other (ShopSectionNav in the header jumps between them).
const ShopDetails = () => {
  const { shopId = "" } = useParams<{ shopId: string }>();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(fetchSingleShop(shopId));
  }, [dispatch, shopId]);

  // The store may still hold the shop opened before this one; until this
  // one's arrives, its details card shows placeholders.
  const selected = useAppSelector(selectSelectedShop);
  const shop = selected?._id === shopId ? selected : null;
  const failed = useAppSelector(selectSelectedFailed) === shopId;
  // A shop that failed to load still names the page (the retry is below).
  usePageTitle(shop ? `Manage ${shop.name}` : failed ? "Shop" : "");

  // The menu, tables and edit form read the manager's own shops (loaded by the
  // Dashboard), so a page opened directly (a reload, a bookmark) loads them.
  const inMyShops = useAppSelector((state) =>
    state.shops.data.some((s) => s._id === shopId)
  );
  useEffect(() => {
    if (!inMyShops) dispatch(fetchShopList());
  }, [inMyShops, dispatch]);

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <Container id="shopDetails" className="ShopDetails">
      {/* The shop's name heads the page; its details, menu and tables are
          its sections, each with its own actions on the right. While the
          shop loads, only the heading and a placeholder card show, and the
          page is swapped whole once it arrives: nothing below the heading is
          on screen to be pushed down, however many lines the name wraps to. */}
      {shop ? (
        <div key="shop">
          <div className="page-head">
            <h1>{shop.name}</h1>
          </div>
          <div className="page-head">
            <h2 className="h5">Details</h2>
            <div className="actions">
              <Button onClick={handleShow}>Edit details</Button>
            </div>
          </div>
          <Card>
            <Row className="align-items-center">
              <Col xs={12} md={6}>
                {/* A 16:9 box kept from the start (ShopDetails.css), so the
                    details don't move when the photo loads. */}
                <div className="shop-cover m-3">
                  {shop.cover && <img src={shop.cover} alt="" />}
                </div>
              </Col>
              <Col xs={12} md={6}>
                <Card.Body className="ms-2">
                  <ListGroup className="align-items-start" variant="flush">
                    <ListGroup.Item>
                      <Card.Text>{shop.bio}</Card.Text>
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <FcClock className="me-2" size={25} />
                      {shop.open_times}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <FcCellPhone className="me-2" size={25} />
                      {shop.phone}
                    </ListGroup.Item>
                    <ListGroup.Item>
                      <FcAddressBook className="me-2" size={25} />
                      <Card.Link
                        className="shop-url d-inline-block py-1"
                        href={shop.web_URL}
                      >
                        {shop.web_URL}
                      </Card.Link>
                    </ListGroup.Item>
                  </ListGroup>
                </Card.Body>
              </Col>
            </Row>
          </Card>
          <ShopMenu shopId={shopId} />
          <TableList shopId={shopId} />
        </div>
      ) : (
        <div key="loading">
          <div className="page-head">
            {/* Full width: in the flex row a heading is only as wide as its
                text, and the placeholder bar is a share of that. */}
            <h1 className="flex-grow-1">
              {failed ? (
                "Shop"
              ) : (
                <span className="placeholder-glow" aria-hidden="true">
                  <span className="placeholder col-6" />
                </span>
              )}
            </h1>
          </div>
          {failed ? (
            <>
              <LoadFailed
                message="Couldn't load this shop."
                onRetry={() => dispatch(fetchSingleShop(shopId))}
              />
              {/* The manager's own copy of the menu and tables may still
                  have loaded. */}
              <ShopMenu shopId={shopId} />
              <TableList shopId={shopId} />
            </>
          ) : (
            <Loading label="Loading the shop">
              {/* The real card's layout, with bars for its lines. */}
              <Card>
                <Row className="align-items-center">
                  <Col xs={12} md={6}>
                    <div className="shop-cover m-3" />
                  </Col>
                  <Col xs={12} md={6}>
                    <Card.Body className="ms-2">
                      <ListGroup variant="flush">
                        <ListGroup.Item>
                          <span className="placeholder col-11 d-block mb-2" />
                          <span className="placeholder col-8 d-block" />
                        </ListGroup.Item>
                        {["col-6", "col-5", "col-7"].map((width) => (
                          <ListGroup.Item key={width} className="py-2">
                            <span className={`placeholder ${width} placeholder-lg`} />
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    </Card.Body>
                  </Col>
                </Row>
              </Card>
            </Loading>
          )}
        </div>
      )}
      <ShopModal show={show} handleClose={handleClose} shopId={shopId} />
    </Container>
  );
};

export default ShopDetails;
