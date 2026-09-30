import "./ShopDetails.css";
import { useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import {
  Card,
  Row,
  Col,
  Button,
  Image,
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
  usePageTitle(shop ? `Manage ${shop.name}` : "");

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
          its sections, each with its own actions on the right. */}
      <div className="page-head">
        <h1>
          {shop ? (
            shop.name
          ) : (
            <span className="placeholder-glow" aria-hidden="true">
              <span className="placeholder col-6" />
            </span>
          )}
        </h1>
      </div>
      <div className="page-head">
        <h2 className="h5">Details</h2>
        {shop && (
          <div className="actions">
            <Button onClick={handleShow}>Edit details</Button>
          </div>
        )}
      </div>
      {shop ? (
        <Card>
          <Row className="align-items-center">
            <Col xs={12} md={6}>
              <Container className="p-3">
                <Image src={shop.cover} fluid />
              </Container>
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
      ) : failed ? (
        <LoadFailed
          message="Couldn't load this shop."
          onRetry={() => dispatch(fetchSingleShop(shopId))}
        />
      ) : (
        <Loading label="Loading the shop">
          <Card className="p-3">
            <Row className="align-items-center">
              <Col xs={12} md={6}>
                <span className="placeholder w-100 d-block" style={{ aspectRatio: "16 / 9" }} />
              </Col>
              <Col xs={12} md={6} className="pt-3 pt-md-0">
                <span className="placeholder col-11 d-block mb-2" />
                <span className="placeholder col-6 d-block mb-2" />
                <span className="placeholder col-7 d-block" />
              </Col>
            </Row>
          </Card>
        </Loading>
      )}
      <ShopModal show={show} handleClose={handleClose} shopId={shopId} />
      <ShopMenu shopId={shopId} />
      <TableList shopId={shopId} />
    </Container>
  );
};

export default ShopDetails;
