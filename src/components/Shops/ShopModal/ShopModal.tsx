import { useId } from "react";
import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Modal, Button, Form, FloatingLabel, Image, Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList, fetchSingleShop } from "../../../redux/slices/shopSlice";
import { IShop } from "../../../typings/shop";
import placeholder from "../../../assets/placeholder.svg";
import "./ShopModal.css";

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

interface ShopModalProps {
  show: boolean;
  handleClose: () => void;
  // shop: IShop | undefined
  shopId: string;
}

const ShopModal = ({ show, handleClose, shopId }: ShopModalProps) => {
  const formId = useId();
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );

  const [editShop, setEditShop] = useState<IShop>({
    _id: "",
    name: "",
    cover: "",
    bio: "",
    open_times: "",
    phone: "",
    web_URL: "",
    shopMg: [],
    tables: [],
    menu: [],
  });
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [phoneInput, setPhoneInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The shop Create made, once it exists: if its cover then fails to upload,
  // pressing Create again saves the fields and the cover to it instead of
  // making a second shop. Forgotten when the dialog is opened again.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (show) setCreatedId(null);
  }, [show]);

  const [imageFile, setImageFile] = useState<File | null>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    setImageFile(files[0]);
  };

  // Each time the dialog opens it starts from the shop as saved (an empty form
  // for a new one), not from what was typed or picked last time.
  useEffect(() => {
    if (!show) return;
    setImageFile(null);
    setError(null);
    setEditShop({
      _id: shop ? shop._id : "",
      name: shop ? shop.name : "",
      cover: shop ? shop.cover : "",
      bio: shop ? shop.bio : "",
      open_times: shop ? shop.open_times : "",
      phone: shop?.phone ?? "",
      web_URL: shop ? shop.web_URL : "",
      shopMg: shop ? shop.shopMg : [],
      tables: shop ? shop.tables : [],
      menu: shop ? shop.menu : [],
    });
    setPhoneInput(shop?.phone ?? "");
  }, [shop, show]);

  const createShop = async () => {
    if (creating) return;
    setError(null);
    if (editShop.name.trim() === "") {
      setError("Name is required");
      return;
    }
    const newShop = {
      name: editShop.name,
      bio: editShop.bio,
      open_times: editShop.open_times,
      // As typed; the BE checks it. Empty clears it.
      phone: phoneInput.trim(),
      web_URL: editShop.web_URL,
    };
    setCreating(true);
    let uploading = false;
    try {
      let id = createdId;
      if (id) {
        await backend.put(`/shops/${id}`, newShop);
      } else {
        id = (await backend.post(`/shops`, newShop)).data._id as string;
        setCreatedId(id);
      }
      if (imageFile) {
        uploading = true;
        const newShopCover = new FormData();
        newShopCover.append("cover", imageFile);
        await backend.put(`/shops/${id}/cover`, newShopCover);
      }
      dispatch(fetchShopList());
      handleClose();
    } catch (err) {
      if (uploading) {
        // The shop exists, so the list shows it; only the cover is missing.
        dispatch(fetchShopList());
        setError(`The shop was created, but its cover wasn't saved: ${getErrorMessage(err)}`);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setCreating(false);
    }
  };

  const updateShop = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (editShop.name.trim() === "") {
      setError("Name is required");
      return;
    }
    const updatedShop = {
      name: editShop.name,
      bio: editShop.bio,
      open_times: editShop.open_times,
      // As typed; the BE checks it. Empty clears it.
      phone: phoneInput.trim(),
      web_URL: editShop.web_URL,
    };
    try {
      await backend.put(`/shops/${editShop._id}`, updatedShop);
      if (imageFile) {
        const newShopCover = new FormData();
        newShopCover.append("cover", imageFile);
        await backend.put(
          `/shops/${editShop._id}/cover`,
          newShopCover
        );
      }
      dispatch(fetchShopList());
      // The shop page shows the selected shop, not the list's copy.
      dispatch(fetchSingleShop(editShop._id));
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const deleteShop = async () => {
    if (!window.confirm("Delete this shop?")) return;
    setError(null);
    try {
      await backend.delete(`/shops/${editShop._id}`);
      navigate("/");
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
          <Modal.Title>Shop</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form id={formId} onSubmit={(e) => updateShop(e)}>
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
                    : editShop.cover || placeholder
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
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Name">
                <Form.Control
                  placeholder="Name"
                  value={editShop.name}
                  onChange={(e) =>
                    setEditShop({ ...editShop, name: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicPassword">
              <FloatingLabel controlId="ffloatingTextarea" label="Bio">
                <Form.Control
                  as="textarea"
                  placeholder="Bio"
                  value={editShop.bio}
                  style={{ height: "200px" }}
                  onChange={(e) =>
                    setEditShop({ ...editShop, bio: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Open Times">
                <Form.Control
                  placeholder="Open Times"
                  value={editShop.open_times}
                  onChange={(e) =>
                    setEditShop({ ...editShop, open_times: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Phone Number">
                <Form.Control
                  type="tel"
                  placeholder="Phone Number"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Web URL">
                <Form.Control
                  placeholder="Web URL"
                  value={editShop.web_URL}
                  onChange={(e) =>
                    setEditShop({ ...editShop, web_URL: e.target.value })
                  }
                />
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
          className={shopId !== "new" ? "justify-content-between" : undefined}
        >
          {shopId !== "new" ? (
            <>
              <Button variant="outline-danger" onClick={deleteShop}>
                Delete Shop
              </Button>
              <Button variant="primary" type="submit" form={formId}>
                Save Changes
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={createShop} disabled={creating}>
              Create Shop
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ShopModal;
