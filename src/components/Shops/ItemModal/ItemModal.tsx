import { ChangeEvent, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Modal, Button, Form, FloatingLabel, Image, Alert } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { IMenu } from "../../../typings/menu";

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
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const menuItem = shop?.menu.find((item) => item._id === itemId);
  // console.log("myItem :", menuItem);

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
    // console.log("imageFile: ", imageFile)
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
      <Modal className="ShopModal" show={show} onHide={handleClose} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Menu Item</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={(e) => updateItem(e)}>
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
                    : item.image ||
                      "https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png"
                }
                height="200px"
                // width="400px"
                alt="cover"
                className="d-block mb-2"
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
                  // style={{ height: '200px' }}
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
              {/* <FloatingLabel controlId="floatingInput" label="Available"> */}
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
              {/* </FloatingLabel> */}
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
            {itemId !== "new" ? (
              <Form.Group className="d-flex justify-content-between">
                <Button
                  variant="outline-danger"
                  className="my-2"
                  onClick={deleteItem}
                >
                  Delete Item
                </Button>
                <Button className="my-2" variant="primary" type="submit">
                  Save Changes
                </Button>
              </Form.Group>
            ) : (
              <Form.Group className="d-flex justify-content-end">
                <Button className="my-2" variant="primary" onClick={createItem}>
                  Create Item
                </Button>
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default ItemModal;
