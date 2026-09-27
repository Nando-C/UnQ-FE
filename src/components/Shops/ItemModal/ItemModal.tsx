import { ChangeEvent, useEffect, useRef, useState, useId } from "react";
import axios from "axios";
import { Modal, Button, Form, FloatingLabel, Image, Alert } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { IMenu } from "../../../typings/menu";
import placeholder from "../../../assets/placeholder.svg";

const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string; details?: { message: string }[] }
      | undefined;
    if (data?.details?.length) return data.details.map((d) => d.message).join(", ");
    if (data?.message) return data.message;
  }
  return "Something went wrong, try again";
};

interface ItemModalProps {
  shopId: string;
  show: boolean;
  handleClose: () => void;
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
    available: false,
    category: "food",
  });
  const [priceInput, setPriceInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItem({
      _id: menuItem ? menuItem._id : "",
      name: menuItem ? menuItem.name : "",
      image: menuItem ? menuItem.image : "",
      short_description: menuItem ? menuItem.short_description : "",
      description: menuItem ? menuItem.description : "",
      price: menuItem ? menuItem.price : 0,
      available: menuItem ? menuItem.available : false,
      category: menuItem ? menuItem.category : "food",
    });
    setPriceInput(menuItem ? String(menuItem.price) : "");
  }, [menuItem]);

  const dispatch = useAppDispatch();

  const [imageFile, setImageFile] = useState<File | null>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    setImageFile(files[0]);
  };

  const createItem = async () => {
    setError(null);
    const price = parseFloat(priceInput);
    if (Number.isNaN(price) || price <= 0) {
      setError("Price must be a positive number");
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
    try {
      const created = await backend.post(`/shops/${shopId}/menu`, newItem);
      if (imageFile) {
        const newItemImg = new FormData();
        newItemImg.append("image", imageFile);
        await backend.put(
          `/shops/${shopId}/menu/${created.data._id}/img`,
          newItemImg
        );
      }
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const updateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const price = parseFloat(priceInput);
    if (Number.isNaN(price) || price <= 0) {
      setError("Price must be a positive number");
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
    try {
      await backend.put(`/shops/${shopId}/menu/${item._id}`, updatedItem);

      if (imageFile) {
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
      setError(getErrorMessage(err));
    }
  };

  const deleteItem = async () => {
    setError(null);
    try {
      await backend.delete(`/shops/${shopId}/menu/${item._id}`);
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
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
              <Button
                variant="dark"
                className="me-2"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Image
              </Button>
              <Button
                variant="outline-dark"
                className="my-2"
                onClick={() => setImageFile(null)}
              >
                Reset Image
              </Button>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Name">
                <Form.Control
                  placeholder="Name"
                  value={item.name}
                  onChange={(e) => setItem({ ...item, name: e.target.value })}
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicPassword">
              <FloatingLabel
                controlId="ffloatingTextarea"
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
            <Form.Group className="mb-3" controlId="formBasicPassword">
              <FloatingLabel controlId="ffloatingTextarea" label="Description">
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
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Price">
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
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Check
                type="switch"
                id="custom-switch"
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
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingSelect" label="Category">
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
        <Modal.Footer
          className={itemId !== "new" ? "justify-content-between" : undefined}
        >
          {itemId !== "new" ? (
            <>
              <Button variant="outline-danger" onClick={deleteItem}>
                Delete Item
              </Button>
              <Button variant="primary" type="submit" form={formId}>
                Save Changes
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={createItem}>
              Create Item
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ItemModal;
