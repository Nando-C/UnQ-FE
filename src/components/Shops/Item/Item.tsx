import { useState } from "react";
import { Button, Card, Collapse, Form, Image } from "react-bootstrap";
import { GrEdit } from "react-icons/gr";
import backend from "../../../backend/backend";
import placeholder from "../../../assets/placeholder.svg";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { setMenuItemAvailability } from "../../../redux/slices/shopSlice";
import ItemModal from "../ItemModal/ItemModal";
import { formatPrice } from "../../../lib/price";
import "./Item.css";

interface ItemProps {
  itemId: string;
  shopId: string;
}

const Item = ({ itemId, shopId }: ItemProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const menuItem = shop?.menu.find((item) => item._id === itemId);

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const dispatch = useAppDispatch();

  const updateAvailable = async () => {
    if (!menuItem || saving) return;
    const available = !menuItem.available;
    setSaving(true);
    setFailed(false);
    // Move the switch now rather than after the round trip. It used to be bound
    // straight to store state that only changed once the PUT *and* a refetch of
    // every shop had landed, so on a slow connection it read as broken — and if
    // the PUT failed it silently stayed on the value the manager had rejected.
    dispatch(setMenuItemAvailability({ shopId, itemId, available }));
    try {
      await backend.put(`/shops/${shopId}/menu/${itemId}`, { available });
    } catch {
      dispatch(
        setMenuItemAvailability({ shopId, itemId, available: !available })
      );
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (!menuItem) return null;

  const detailsId = `item-details-${menuItem._id}`;

  return (
    <>
      {/* text-start: ShopDetails wraps the whole page in a text-center
          Container, and a menu row is a left-aligned list row, not a poster. */}
      <div className="Item text-start">
        <Card className="p-3">
          <div className="item-row">
            {/* Decorative: the name sits immediately beside it, so alt text
                here would only make a screen reader announce the dish twice. */}
            <Image
              className="item-thumb"
              src={menuItem.image || placeholder}
              alt=""
              rounded
            />
            {/* Two rows beside the thumbnail. Splitting the name onto its own
                line lets a long one wrap against the full text column, and
                keeps the edit button — which opens a form — away from the
                availability switch, which commits the moment it is touched. */}
            <div className="item-main">
              <div className="item-head">
                <Card.Title as="h3" className="item-name">
                  {menuItem.name}
                </Card.Title>
                <Button
                  variant="link"
                  className="item-edit"
                  onClick={handleShow}
                  aria-label={`Edit ${menuItem.name}`}
                >
                  <GrEdit size={18} />
                </Button>
              </div>
              <div className="item-sub">
                <div className="item-body">
                  {/* Only when there is one — an empty field used to render
                      its heading over nothing. title= gives back the tail. */}
                  {menuItem.short_description && (
                    <div
                      className="item-short text-truncate"
                      title={menuItem.short_description}
                    >
                      {menuItem.short_description}
                    </div>
                  )}
                </div>
                <div className="item-meta">
                  <span className="price text-primary">
                    {formatPrice(menuItem.price)}
                  </span>
                  <Form.Check
                    type="switch"
                    // Unique per item: a shop menu renders many of these, and
                    // the shared "custom-switch" id put duplicate ids on the
                    // page, so every label pointed at the first item's switch.
                    id={`available-${menuItem._id}`}
                    // react-bootstrap only emits a <label> when the check is
                    // given one, so without this the switch reached the
                    // accessibility tree unnamed — identical "checkbox,
                    // checked" nodes. role="switch" also gets it announced as
                    // on/off rather than checked.
                    role="switch"
                    aria-label={`${menuItem.name} available`}
                    checked={menuItem.available}
                    disabled={saving}
                    onChange={() => updateAvailable()}
                  />
                </div>
              </div>
            </div>
          </div>

          {failed && (
            <div className="item-error text-danger small" role="alert">
              Couldn’t update availability — the switch has been put back.
            </div>
          )}

          {/* The full description is the one field long enough to set the row's
              height, and a manager scanning a menu rarely needs it. Behind a
              disclosure the list stays one row per item; rendered only when
              there is a description, so no empty panel. */}
          {menuItem.description && (
            <>
              <Button
                variant="link"
                size="sm"
                className="item-details-toggle"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                aria-controls={detailsId}
              >
                {open ? "Hide details" : "Details"}
              </Button>
              <Collapse in={open}>
                <div id={detailsId}>
                  <p className="item-description">{menuItem.description}</p>
                </div>
              </Collapse>
            </>
          )}
        </Card>
        <ItemModal
          shopId={shopId}
          show={show}
          handleClose={handleClose}
          itemId={menuItem._id}
        />
      </div>
    </>
  );
};

export default Item;
