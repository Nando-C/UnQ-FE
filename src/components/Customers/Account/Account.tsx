import { Card, Container, Image, Button } from "react-bootstrap";
import { useAppSelector } from "../../../redux/app/hooks";
import { selectUserData } from "../../../redux/slices/userSlice";
import { GrEdit } from "react-icons/gr";
import "./Account.css";
import { useState } from "react";
import AccountOffCanvas from "../AccountOffCanvas/AccountOffCanvas";
import backend from "../../../backend/backend";
import { useHistory } from "react-router";
import Login from "../../Login/Login";

const Account = () => {
  const user = useAppSelector(selectUserData);
  const history = useHistory();

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const logOut = async () => {
    try {
      await backend.get("/auth/logout");
      history.push("/login");
    } catch (error) {
      console.log(error);
    }
  };

  // const logIn = () => {
  //   history.push("/login");
  // };

  return (
    <>
      {user._id ? (
        <Container className="Account p-2 text-center">
          <Card className="p-2">
            <Image className="p-5" src={user.avatar} fluid roundedCircle />
            <Card.Title className="mt-3">
              {user.name} {user.surname}
            </Card.Title>
            <Card.Body>
              <Card.Text>email: {user.email}</Card.Text>
              <Card.Text>Role: {user.role}</Card.Text>
            </Card.Body>
            <Button size={"lg"} onClick={handleShow}>
              <GrEdit />
            </Button>
          </Card>
          <Button className="my-5" onClick={logOut}>
            LogOut
          </Button>
        </Container>
      ) : (
        <Login />
      )}
      <AccountOffCanvas show={show} handleClose={handleClose} />
    </>
  );
};

export default Account;
