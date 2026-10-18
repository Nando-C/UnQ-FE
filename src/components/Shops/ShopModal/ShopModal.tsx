import { useId } from "react";
import React, { ChangeEvent, useEffect, useRef, useState } from "react";
import { Modal, Button, Form, FloatingLabel, Image, Alert, ListGroup } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList, fetchSingleShop } from "../../../redux/slices/shopSlice";
import { IShop } from "../../../typings/shop";
import { IListedUser } from "../../../typings/user";
import { selectUserData } from "../../../redux/slices/userSlice";
import placeholder from "../../../assets/placeholder.svg";
import "./ShopModal.css";
import { apiErrorMessage } from "../../../lib/errors";
import { uploadImage } from "../../../lib/upload";
import { useObjectURL } from "../../../lib/useObjectURL";
import { ConfirmFooter } from "../../Common/ConfirmFooter";
import { useConfirmDelete } from "../../../lib/useConfirmDelete";
import { DEFAULT_TIME_ZONE } from "../../../lib/sales";

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// The time zones a shop can count its days in: the browser's list of IANA
// names, with UTC and the API's default always among them; the API accepts
// any name it can format dates in, so a shop's saved zone is offered too
// whatever this browser's list says. The browser's own zone is the first
// guess for a new shop.
const TIME_ZONES: string[] = (() => {
  const known = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set([DEFAULT_TIME_ZONE, "UTC", ...known])].sort();
})();
const zonesWith = (zone: string | undefined) => (zone && !TIME_ZONES.includes(zone) ? [...TIME_ZONES, zone].sort() : TIME_ZONES);
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;

// What deleting a shop takes with it: its menu and its tables, whose printed
// QR codes then lead nowhere, and its payment records. (The BE refuses while a
// paid cart closed less than a day ago, or a payment provider still owes an answer.)
const deleteShopMessage = (shop: IShop | undefined) => {
  if (!shop) return "Delete this shop?";
  const tables = shop.tables.length;
  return (
    `Delete ${shop.name}? This also deletes its ${count(shop.menu.length, "menu item")} ` +
    `and ${count(tables, "table")}` +
    (tables ? ", and their QR codes stop working." : ".") +
    " Its payment history goes too: refunds can then only be made from the payment provider."
  );
};

interface ShopModalProps {
  show: boolean;
  handleClose: () => void;
  // "new" to create a shop.
  shopId: string;
}

const EMPTY_SHOP: IShop = {
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
  timeZone: DEFAULT_TIME_ZONE,
};

// The accounts an administrator may name as a new shop's owner: those matching
// what was typed (GET /users?q=, a page of this many), bar administrators, who
// are never members.
const OWNER_MATCHES = 10;
const ownerName = (account: Pick<IListedUser, "name" | "surname">) => [account.name, account.surname].filter(Boolean).join(" ");

const ShopModal = ({ show, handleClose, shopId }: ShopModalProps) => {
  const formId = useId();
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  // An administrator is never a member of a shop, so one they create needs
  // its owner named (the API refuses otherwise): the Owner field below.
  const isAdmin = useAppSelector(selectUserData).role === "admin";
  const namesOwner = isAdmin && shopId === "new";

  const [editShop, setEditShop] = useState<IShop>(EMPTY_SHOP);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // The shop Create made, once it exists: if its cover then fails to upload,
  // pressing Create again saves the fields and the cover to it instead of
  // making a second shop. Forgotten when the dialog is opened again.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  // Deleting asks first, in the footer (ConfirmFooter), saying what goes.
  const confirmDelete = useConfirmDelete(show);
  // Opening the dialog also drops the cover picked and the error shown last
  // time. Only on opening: an error set just after a save reloaded the shop
  // must stay.
  useEffect(() => {
    if (!show) return;
    setCreatedId(null);
    setImageFile(null);
    setError(null);
    setOwner(null);
    setOwnerQuery("");
  }, [show]);

  // The Owner field: what was typed, the accounts matching it (null until
  // asked, or while the text is empty), and the one picked. The search goes
  // out a moment after typing stops, and only the latest answer is shown.
  const [owner, setOwner] = useState<IListedUser | null>(null);
  const [ownerQuery, setOwnerQuery] = useState("");
  const [ownerMatches, setOwnerMatches] = useState<IListedUser[] | null>(null);
  const [ownerSearchFailed, setOwnerSearchFailed] = useState(false);
  const ownerSearches = useRef(0);
  useEffect(() => {
    // Whatever was asked before no longer applies: an owner was picked, or the
    // text was cleared.
    const search = ++ownerSearches.current;
    if (!namesOwner || owner) return;
    const q = ownerQuery.trim();
    if (!q) {
      setOwnerMatches(null);
      setOwnerSearchFailed(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await backend.get<{ users: IListedUser[] }>("/users", { params: { q, limit: OWNER_MATCHES } });
        if (search !== ownerSearches.current) return;
        setOwnerMatches(data.users.filter((account) => account.role !== "admin"));
        setOwnerSearchFailed(false);
      } catch {
        if (search !== ownerSearches.current) return;
        setOwnerMatches(null);
        setOwnerSearchFailed(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [namesOwner, owner, ownerQuery]);

  const [imageFile, setImageFile] = useState<File | null>();
  const preview = useObjectURL(imageFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    setImageFile(files[0]);
  };

  // Each time the dialog opens it starts from the shop as saved (an empty form
  // for a new one), not from what was typed last time; and it follows the
  // saved shop when that reloads.
  useEffect(() => {
    if (!show) return;
    // A shop saved without a zone counts in the API's default; a new one
    // starts from the browser's.
    setEditShop({ ...EMPTY_SHOP, ...shop, phone: shop?.phone ?? "", timeZone: shop ? (shop.timeZone ?? DEFAULT_TIME_ZONE) : browserTimeZone() });
  }, [shop, show]);

  // What the saved shop is shown from: the list, and for an existing shop its
  // page too, which shows the selected shop, not the list's copy.
  const reload = () => {
    dispatch(fetchShopList());
    if (shop) dispatch(fetchSingleShop(editShop._id));
  };

  // Saves the form to the shop `id` (the one edited, or the one an earlier
  // Create made), or as a new shop without one; then its cover, if one was
  // picked. Create and the form's submit both come here.
  const saveShop = async (id: string | null) => {
    setError(null);
    if (editShop.name.trim() === "") {
      setError("Name is required");
      return;
    }
    if (namesOwner && !id && !owner) {
      setError("Choose the shop's owner");
      return;
    }
    const fields = {
      name: editShop.name,
      bio: editShop.bio,
      open_times: editShop.open_times,
      // As typed; the BE checks it. Empty clears it.
      phone: (editShop.phone ?? "").trim(),
      web_URL: editShop.web_URL,
      timeZone: editShop.timeZone,
    };
    let uploading = false;
    try {
      if (id) {
        await backend.put(`/shops/${id}`, fields);
      } else {
        // Only an administrator names the owner; a manager's own shop is theirs.
        id = (await backend.post(`/shops`, namesOwner ? { ...fields, ownerId: owner!._id } : fields)).data._id as string;
        setCreatedId(id);
      }
      if (imageFile) {
        uploading = true;
        await uploadImage(`/shops/${id}/cover`, "cover", imageFile);
      }
      reload();
      handleClose();
    } catch (err) {
      if (uploading) {
        // The shop is saved, so the list and the page show it; only the cover
        // is missing.
        reload();
        setError(
          shop
            ? `The changes were saved, but the cover wasn't: ${apiErrorMessage(err)}`
            : `The shop was created, but its cover wasn't saved: ${apiErrorMessage(err)}`
        );
      } else {
        setError(apiErrorMessage(err));
      }
    }
  };

  const createShop = async () => {
    if (creating) return;
    setCreating(true);
    try {
      await saveShop(createdId);
    } finally {
      setCreating(false);
    }
  };

  const updateShop = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return saveShop(editShop._id);
  };

  const deleteShop = () => {
    setError(null);
    return confirmDelete.run(
      async () => {
        await backend.delete(`/shops/${editShop._id}`);
        navigate("/");
        handleClose();
      },
      (err) => setError(apiErrorMessage(err))
    );
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
                src={preview ?? (editShop.cover || placeholder)}
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
                  value={editShop.name}
                  onChange={(e) =>
                    setEditShop({ ...editShop, name: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            {namesOwner && (
              <Form.Group className="mb-3">
                {owner ? (
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    <span>
                      Owner: <strong>{ownerName(owner)}</strong> <span className="text-break">({owner.email})</span>
                    </span>
                    <Button variant="link" size="sm" className="p-0" onClick={() => setOwner(null)}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <FloatingLabel controlId={`${formId}-owner`} label="Owner (search by name or email)">
                      <Form.Control
                        placeholder="Owner"
                        autoComplete="off"
                        value={ownerQuery}
                        onChange={(e) => setOwnerQuery(e.target.value)}
                      />
                    </FloatingLabel>
                    {ownerMatches && ownerMatches.length > 0 && (
                      <ListGroup as="ul" className="mt-1" aria-label="Matching accounts">
                        {ownerMatches.map((account) => (
                          <ListGroup.Item as="li" key={account._id} className="p-0">
                            <Button
                              variant="link"
                              className="w-100 text-start text-decoration-none px-3 py-2"
                              onClick={() => setOwner(account)}
                            >
                              {ownerName(account)} <span className="text-muted text-break">· {account.email}</span>
                            </Button>
                          </ListGroup.Item>
                        ))}
                      </ListGroup>
                    )}
                    {/* Said aloud as the search answers, since the list below the
                        field appears without the focus moving. */}
                    <div role="status">
                      {ownerMatches?.length === 0 && <Form.Text>No account matches.</Form.Text>}
                      {ownerSearchFailed && <Form.Text className="text-danger">Couldn't search the accounts.</Form.Text>}
                    </div>
                  </>
                )}
                <Form.Text as="div">The owner runs the shop and adds its managers.</Form.Text>
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-bio`} label="Bio">
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
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-open-times`} label="Open Times">
                <Form.Control
                  placeholder="Open Times"
                  value={editShop.open_times}
                  onChange={(e) =>
                    setEditShop({ ...editShop, open_times: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-phone`} label="Phone Number">
                <Form.Control
                  type="tel"
                  placeholder="Phone Number"
                  value={editShop.phone ?? ""}
                  onChange={(e) =>
                    setEditShop({ ...editShop, phone: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-web-url`} label="Web URL">
                <Form.Control
                  placeholder="Web URL"
                  value={editShop.web_URL}
                  onChange={(e) =>
                    setEditShop({ ...editShop, web_URL: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3">
              <FloatingLabel controlId={`${formId}-time-zone`} label="Time zone">
                <Form.Select
                  value={editShop.timeZone}
                  onChange={(e) => setEditShop({ ...editShop, timeZone: e.target.value })}
                >
                  {zonesWith(editShop.timeZone).map((zone) => (
                    <option key={zone} value={zone}>
                      {zone.replaceAll("_", " ")}
                    </option>
                  ))}
                </Form.Select>
              </FloatingLabel>
              <Form.Text>Sales are counted in the shop's own days: a day starts and ends on this clock.</Form.Text>
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
        {confirmDelete.confirming ? (
          <ConfirmFooter
            message={deleteShopMessage(shop)}
            confirmLabel="Delete shop"
            danger
            busy={confirmDelete.busy}
            onConfirm={deleteShop}
            onCancel={confirmDelete.cancel}
            returnFocus={() => confirmDelete.buttonRef.current}
          />
        ) : (
          <Modal.Footer
            className={shopId !== "new" ? "justify-content-between" : undefined}
          >
            {shopId !== "new" ? (
              <>
                <Button
                  ref={confirmDelete.buttonRef}
                  variant="outline-danger"
                  onClick={confirmDelete.ask}
                >
                  Delete shop
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
        )}
      </Modal>
    </>
  );
};

export default ShopModal;
