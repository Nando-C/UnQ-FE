import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Alert,
  Form,
  Image,
  Offcanvas,
  Button,
  FloatingLabel,
} from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchUserData, selectUserData } from "../../../redux/slices/userSlice";
import { IUser } from "../../../typings/user";
import placeholder from "../../../assets/placeholder.svg";
import "./AccountOffCanvas.css";
import { apiErrorMessage } from "../../../lib/errors";

interface AccountOffCanvasProps {
  show: boolean;
  handleClose: () => void;
}
const AccountOffCanvas = ({ show, handleClose }: AccountOffCanvasProps) => {
  const dispatch = useAppDispatch();
  const myUser = useAppSelector(selectUserData);

  const [user, setUser] = useState<IUser>({
    _id: "",
    name: "",
    surname: "",
    email: "",
    avatar: "",
    role: "",
  });
  // The form follows the saved account, and starts from it each time the panel
  // opens, not from edits made and abandoned last time.
  useEffect(() => {
    if (!show) return;
    setUser({
      _id: myUser._id,
      name: myUser.name,
      surname: myUser.surname ?? "",
      email: myUser.email,
      avatar: myUser.avatar,
      role: myUser.role,
    });
  }, [myUser, show]);

  const [imageFile, setImageFile] = useState<File | null>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  // Opening the panel also drops the photo picked, the password typed and the
  // error shown last time. Only on opening: an error set just after a save
  // reloaded the account must stay.
  useEffect(() => {
    if (!show) return;
    setImageFile(null);
    setCurrentPassword("");
    setError(null);
  }, [show]);
  // The BE asks for the current password to change the email of an account
  // that has one (it compares addresses trimmed and lowercased, as it stores them).
  const emailChanges = user.email.trim().toLowerCase() !== myUser.email.trim().toLowerCase();
  const needsPassword = emailChanges && !!myUser.hasPassword;

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    setImageFile(files[0]);
  };

  const updateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    let uploading = false;
    try {
      await backend.put(`/users/me`, {
        name: user.name,
        // Left out while empty on an account that never had one (a Google
        // account can be without it); the BE refuses an empty surname.
        ...((user.surname || myUser.surname) && { surname: user.surname }),
        email: user.email,
        ...(needsPassword && { currentPassword }),
      });
      setCurrentPassword("");

      if (imageFile) {
        uploading = true;
        const newItemImg = new FormData();
        newItemImg.append("avatar", imageFile);
        await backend.put(`/users/me/avatar`, newItemImg);
      }
      dispatch(fetchUserData());
      handleClose();
    } catch (err) {
      if (uploading) {
        // The details are saved, so the account shows them too (and a changed
        // email no longer asks for the password again).
        dispatch(fetchUserData());
        setError(`Your details were saved, but the photo wasn't: ${apiErrorMessage(err)}`);
      } else {
        setError(apiErrorMessage(err));
      }
    }
  };

  return (
    <>
      <Offcanvas show={show} placement="end" onHide={handleClose}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Edit User Details</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="pt-0">
          <Form onSubmit={(e) => updateUser(e)}>
            <Form.Group className="mb-2">
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
                    : user?.avatar || placeholder
                }
                width={200}
                height={200}
                alt=""
                className="avatar-preview d-block mx-auto mb-4"
                roundedCircle
              />
              <div className="d-grid gap-2 mx-5">
                {/* Secondary: a teal outline, so the filled Save stays the one
                    action that stands out. */}
                <Button
                  variant="outline-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Image
                </Button>
                {/* Only once a new photo has been picked: it undoes that
                    pick. The input is cleared too, or picking the same file
                    again would fire no change. */}
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
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Surname">
                <Form.Control
                  placeholder="Surname"
                  value={user.surname}
                  onChange={(e) =>
                    setUser({ ...user, surname: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Email">
                <Form.Control
                  type="email"
                  placeholder="Email"
                  value={user.email}
                  onChange={(e) => setUser({ ...user, email: e.target.value })}
                />
              </FloatingLabel>
            </Form.Group>
            {needsPassword && (
              <Form.Group className="mb-3" controlId="accountCurrentPassword">
                <FloatingLabel label="Current password">
                  <Form.Control
                    type="password"
                    placeholder="Current password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </FloatingLabel>
                <Form.Text>Needed to change your email.</Form.Text>
              </Form.Group>
            )}
            {error && (
              <Alert className="my-2" variant="danger">
                {error}
              </Alert>
            )}
            <Form.Group className="d-flex justify-content-end">
              <Button className="my-2" variant="primary" type="submit">
                Save Changes
              </Button>
            </Form.Group>
          </Form>
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
};

export default AccountOffCanvas;
