import { ChangeEvent, useEffect, useRef, useState, useId } from "react";
import { Modal, Button, Form, FloatingLabel, Image, Alert } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { IMenu } from "../../../typings/menu";
import placeholder from "../../../assets/placeholder.svg";
import { apiErrorMessage } from "../../../lib/errors";
import { ConfirmFooter } from "../../Common/ConfirmFooter";

// Why a typed price can't be sent, or null. Whole pence, as the BE requires:
// refunds price each line on its own, so a fraction of a penny wouldn't add up.
const priceError = (input: string, price: number): string | null => {
  if (Number.isNaN(price) || price <= 0) return "Price must be a positive number";
  if (!/^\s*\d*(\.\d{0,2})?\s*$/.test(input)) return "Price must be in whole pence (at most 2 decimals)";
  return null;
};

interface ItemModalProps {
  shopId: string;
  show: boolean;
  handleClose: () => void;
  // "new" to create an item.
  itemId: string;
}

const ItemModal = ({ shopId, show, handleClose, itemId }: ItemModalProps) => {
  const formId = useId();
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const menuItem = shop?.menu.find((item) => item._id === itemId);

  const [item, setItem] = useState<IMenu>({
    _id: "",
    name: "",
    image: "",
    short_description: "",
    description: "",
    price: 0,
    available: true,
    category: "food",
  });
  const [priceInput, setPriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The item Create made, once it exists: if its image then fails to upload,
  // pressing Create again saves the fields and the image to it instead of
  // making a second item. Forgotten when the dialog is opened again.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Deleting asks first, in the footer (ConfirmFooter), saying what goes. A
  // question left open doesn't greet the next opening of the dialog.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Focus goes back to it when the question closes without deleting.
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  // A question left open when the dialog closed (Esc, the backdrop) is dropped
  // in the render that reopens it, so it never shows, or takes focus, again.
  const [wasShown, setWasShown] = useState(show);
  if (show !== wasShown) {
    setWasShown(show);
    if (show) setConfirmingDelete(false);
  }
  // Opening the dialog also drops the photo picked and the error shown last
  // time. Only on opening: an error set just after a save reloaded the menu
  // must stay.
  useEffect(() => {
    if (!show) return;
    setCreatedId(null);
    setImageFile(null);
    setError(null);
  }, [show]);

  // Each time the dialog opens it starts from the item as saved (an empty form
  // for a new one, available by default as on the BE), not from what was typed
  // last time; and it follows the saved item when that reloads.
  useEffect(() => {
    if (!show) return;
    setItem({
      _id: menuItem ? menuItem._id : "",
      name: menuItem ? menuItem.name : "",
      image: menuItem ? menuItem.image : "",
      short_description: menuItem ? menuItem.short_description : "",
      description: menuItem ? menuItem.description : "",
      price: menuItem ? menuItem.price : 0,
      available: menuItem ? menuItem.available : true,
      category: menuItem ? menuItem.category : "food",
    });
    setPriceInput(menuItem ? String(menuItem.price) : "");
  }, [menuItem, show]);

  const dispatch = useAppDispatch();

  const [imageFile, setImageFile] = useState<File | null>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    setImageFile(files[0]);
  };

  const createItem = async () => {
    if (creating) return;
    setError(null);
    const price = parseFloat(priceInput);
    const problem = priceError(priceInput, price);
    if (problem) {
      setError(problem);
      return;
    }
    const newItem = {
      name: item.name,
      short_description: item.short_description,
      description: item.description,
      price,
      available: item.available,
      category: item.category,
    };
    setCreating(true);
    let uploading = false;
    try {
      let id = createdId;
      if (id) {
        await backend.put(`/shops/${shopId}/menu/${id}`, newItem);
      } else {
        id = (await backend.post(`/shops/${shopId}/menu`, newItem)).data._id as string;
        setCreatedId(id);
      }
      if (imageFile) {
        uploading = true;
        const newItemImg = new FormData();
        newItemImg.append("image", imageFile);
        await backend.put(`/shops/${shopId}/menu/${id}/img`, newItemImg);
      }
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      if (uploading) {
        // The item exists, so the menu shows it; only the image is missing.
        dispatch(fetchShopList());
        setError(`The item was created, but its image wasn't saved: ${apiErrorMessage(err)}`);
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setCreating(false);
    }
  };

  const updateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const price = parseFloat(priceInput);
    const problem = priceError(priceInput, price);
    if (problem) {
      setError(problem);
      return;
    }
    const updatedItem = {
      name: item.name,
      short_description: item.short_description,
      description: item.description,
      price,
      available: item.available,
      category: item.category,
    };
    let uploading = false;
    try {
      await backend.put(`/shops/${shopId}/menu/${item._id}`, updatedItem);

      if (imageFile) {
        uploading = true;
        const newItemImg = new FormData();
        newItemImg.append("image", imageFile);
        await backend.put(
          `/shops/${shopId}/menu/${item._id}/img`,
          newItemImg
        );
      }
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      if (uploading) {
        // The changes are saved (diners see them), so the menu shows them too.
        dispatch(fetchShopList());
        setError(`The changes were saved, but the image wasn't: ${apiErrorMessage(err)}`);
      } else {
        setError(apiErrorMessage(err));
      }
    }
  };

  const deleteItem = async () => {
    setDeleting(true);
    setError(null);
    try {
      await backend.delete(`/shops/${shopId}/menu/${item._id}`);
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(apiErrorMessage(err));
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Modal
        className="ShopModal"
        show={show}
        onHide={handleClose}
        size="lg"
        fullscreen="sm-down"
        scrollable
      >
        <Modal.Header closeButton>
          <Modal.Title>Menu Item</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form id={formId} onSubmit={(e) => updateItem(e)}>
            <Form.Group className="my-2">
              <Form.Control
                type="file"
                hidden
                ref={fileInputRef}
                onChange={handleFile}
              />
              <Image
                src={
                  imageFile
                    ? URL.createObjectURL(imageFile)
                    : item.image || placeholder
                }
                height="200px"
                alt="cover"
                className="preview d-block mb-2"
              />
              {/* A fixed gap, so the form doesn't shift when Reset appears. */}
              <div className="d-flex flex-wrap gap-2">
                {/* Secondary: a teal outline, so the filled Save stays the one
                    action that stands out. */}
                <Button
                  variant="outline-primary"
                                onClick={() => fileInputRef.current?.click()}
                >
                  Upload Image
                </Button>
                {/* Only once a new photo has been picked: it undoes that pick. The
                    input is cleared too, or picking the same file again would fire
                    no change. */}
                {imageFile && (
                  <Button
                    variant="outline-secondary"
                                  onClick={() => {
                      setImageFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Reset Image
                  </Button>
                )}
              </div>
            </Form.Group>
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-name`} label="Name">
                <Form.Control
                  placeholder="Name"
                  value={item.name}
                  onChange={(e) => setItem({ ...item, name: e.target.value })}
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3">
              <FloatingLabel
                controlId={`${formId}-short-description`}
                label="Short Description"
              >
                <Form.Control
                  as="textarea"
                  placeholder="Short Description"
                  value={item.short_description}
                  style={{ height: "80px" }}
                  onChange={(e) =>
                    setItem({ ...item, short_description: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-description`} label="Description">
                <Form.Control
                  as="textarea"
                  placeholder="Description"
                  value={item.description}
                  style={{ height: "200px" }}
                  onChange={(e) =>
                    setItem({ ...item, description: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-price`} label="Price">
                <Form.Control
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Price"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id={`${formId}-available`}
                checked={item.available}
                onChange={(e) =>
                  setItem({
                    ...item,
                    available: e.target.checked ? true : false,
                  })
                }
                label="Available"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-category`} label="Category">
                <Form.Select
                  value={item.category}
                  onChange={(e) =>
                    setItem({ ...item, category: e.currentTarget.value })
                  }
                >
                  <option value="food">Food</option>
                  <option value="drinks">Drinks</option>
                </Form.Select>
              </FloatingLabel>
            </Form.Group>
            {error && (
              <Alert className="my-2" variant="danger">
                {error}
              </Alert>
            )}
          </Form>
        </Modal.Body>
        {/* Outside the scrolling body, so the actions stay in view however
            long the form is. The submit button reaches the form through its
            form attribute. */}
        {confirmingDelete ? (
          <ConfirmFooter
            // The saved name: that is the item deleted, whatever the form says.
            message={`Delete ${menuItem?.name ?? "this item"} from the menu? Diners can no longer order it.`}
            confirmLabel="Delete item"
            danger
            busy={deleting}
            onConfirm={deleteItem}
            onCancel={() => setConfirmingDelete(false)}
            returnFocus={() => deleteButtonRef.current}
          />
        ) : (
          <Modal.Footer
            className={itemId !== "new" ? "justify-content-between" : undefined}
          >
            {itemId !== "new" ? (
              <>
                <Button
                ref={deleteButtonRef}
                variant="outline-danger"
                onClick={() => setConfirmingDelete(true)}
              >
                  Delete item
                </Button>
                <Button variant="primary" type="submit" form={formId}>
                  Save Changes
                </Button>
              </>
            ) : (
              <Button variant="primary" onClick={createItem} disabled={creating}>
                Create Item
              </Button>
            )}
          </Modal.Footer>
        )}
      </Modal>
    </>
  );
};

export default ItemModal;
