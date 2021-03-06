import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Modal, Button, Form, FloatingLabel, Image } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { IMenu } from "../../../typings/menu";

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
    category: "",
  });

  useEffect(() => {
    setItem({
      _id: menuItem ? menuItem._id : "",
      name: menuItem ? menuItem.name : "",
      image: menuItem ? menuItem.image : "",
      short_description: menuItem ? menuItem.short_description : "",
      description: menuItem ? menuItem.description : "",
      price: menuItem ? menuItem.price : 0,
      available: menuItem ? menuItem.available : false,
      category: menuItem ? menuItem.category : "",
    });
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
    const newItem = {
      name: item.name,
      short_description: item.short_description,
      description: item.description,
      price: item.price,
      available: item.available,
      category: item.category,
    };
    const created = await backend.post(`/shops/${shopId}/menu`, newItem);
    if (imageFile) {
      const newItemImg = new FormData();
      newItemImg.append("image", imageFile);
      const newImage = await backend.put(
        `/shops/${shopId}/menu/${created.data._id}/img`,
        newItemImg
      );
      console.log(newImage);
    }
    dispatch(fetchShopList());
    handleClose();
  };

  const updateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = await backend.put(`/shops/${shopId}/menu/${item._id}`, item);
    console.log("updateItem: ", data); //<=========================================== LOG

    if (imageFile) {
      const newItemImg = new FormData();
      newItemImg.append("image", imageFile);
      const newImage = await backend.put(
        `/shops/${shopId}/menu/${item._id}/img`,
        newItemImg
      );
      console.log(newImage);
    }
    dispatch(fetchShopList());
    handleClose();
  };

  const deleteItem = async () => {
    const deleted = await backend.delete(`/shops/${shopId}/menu/${item._id}`);
    console.log("updateItem: ", deleted); //<=========================================== LOG
    // console.log("Deleted")
    // history.push("/")
    dispatch(fetchShopList());
    handleClose();
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
                  placeholder="Price"
                  value={item.price}
                  onChange={(e) =>
                    setItem({ ...item, price: parseInt(e.target.value) })
                  }
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
              <FloatingLabel controlId="floatingInput" label="Category">
                <Form.Control
                  placeholder="Category"
                  value={item.category}
                  onChange={(e) =>
                    setItem({ ...item, category: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
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
