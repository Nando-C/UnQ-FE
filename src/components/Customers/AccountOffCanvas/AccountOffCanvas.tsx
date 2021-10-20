import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [imageFile, setImageFile] = useState<File | null>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    setImageFile(files[0]);
    // console.log("imageFile: ", imageFile)
  };

  const updateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const data = await backend.put(`/users/me`, user);
    console.log("updatedUser: ", data); //<=========================================== LOG

    if (imageFile) {
      const newItemImg = new FormData();
      newItemImg.append("avatar", imageFile);
      const newImage = await backend.put(`/users/me/avatar`, newItemImg);
      console.log(newImage);
    }
    dispatch(fetchUserData());
    handleClose();
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
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingSelect" label="Role">
                <Form.Select
                  aria-label="Floating label select example"
                  value={user.role}
                  onChange={(e) =>
                    setUser({ ...user, role: e.currentTarget.value })
                  }
                >
                  <option>Open this select menu</option>
                  <option value="customer">Customer</option>
                  <option value="shopMg">Shop Manager</option>
                </Form.Select>
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="d-flex justify-content-end">
              {/* <Button variant="outline-danger" className="my-2" onClick={deleteItem}>
                                Delete Item
                            </Button> */}
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
