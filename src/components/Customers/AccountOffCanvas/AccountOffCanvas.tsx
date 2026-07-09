import { ChangeEvent, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Alert,
  Form,
  Image,
  Offcanvas,
  Button,
  FloatingLabel,
  Row,
} from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchUserData, selectUserData } from "../../../redux/slices/userSlice";
import { IUser } from "../../../typings/user";
import "./AccountOffCanvas.css";

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

interface AccountOffCanvasProps {
  show: boolean;
  handleClose: () => void;
}
const AccountOffCanvas = ({ show, handleClose }: AccountOffCanvasProps) => {
  const dispatch = useAppDispatch();
  // dispatch(fetchUserData())
  const myUser = useAppSelector(selectUserData);

  const [user, setUser] = useState<IUser>({
    _id: "",
    name: "",
    surname: "",
    email: "",
    avatar: "",
    role: "",
  });
  useEffect(() => {
    setUser({
      _id: myUser._id,
      name: myUser.name,
      surname: myUser.surname,
      email: myUser.email,
      avatar: myUser.avatar,
      role: myUser.role,
    });
  }, [myUser]);

  const [imageFile, setImageFile] = useState<File | null>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    setImageFile(files[0]);
    // console.log("imageFile: ", imageFile)
  };

  const updateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    try {
      await backend.put(`/users/me`, {
        name: user.name,
        surname: user.surname,
        email: user.email,
      });

      if (imageFile) {
        const newItemImg = new FormData();
        newItemImg.append("avatar", imageFile);
        await backend.put(`/users/me/avatar`, newItemImg);
      }
      dispatch(fetchUserData());
      handleClose();
    } catch (err) {
      setError(getErrorMessage(err));
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
                    : user?.avatar ||
                      "https://via.placeholder.com/600x600?text=Blog+Image"
                }
                height="200px"
                // width="400px"
                alt="cover"
                className="d-block mx-auto pb-5"
                roundedCircle
              />
              <Row className="mx-5">
                <Button
                  variant="dark"
                  className=""
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
              </Row>
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
