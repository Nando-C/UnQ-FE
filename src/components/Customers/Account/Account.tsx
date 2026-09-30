import { Card, Container, Image, Button } from "react-bootstrap";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { logOut, selectUserData, selectUserStatus } from "../../../redux/slices/userSlice";
import { GrEdit } from "react-icons/gr";
import "./Account.css";
import { useState } from "react";
import AccountOffCanvas from "../AccountOffCanvas/AccountOffCanvas";
import { useNavigate } from "react-router-dom";
import Login from "../../Login/Login";

const Account = () => {
  const user = useAppSelector(selectUserData);
  const status = useAppSelector(selectUserStatus);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const logMeOut = () => {
    dispatch(logOut());
    navigate("/login");
  };

  return (
    <>
      {status === "authenticated" ? (
        <Container className="Account phone-column px-2 pb-2 text-center">
          <Card className="p-2">
            {/* One column at every width (the page is a phone-width column
                on wide screens too), so the corner edit button never sits
                over the name. */}
            <div>
              <Image className="avatar my-4" src={user.avatar} alt="" roundedCircle />
            </div>
            <Card.Title>
              {user.name} {user.surname}
            </Card.Title>
            <Card.Body>
              <Card.Text className="text-break">{user.email}</Card.Text>
              {/* Diners aren't shown a role; a manager sees they are one. */}
              {user.role === "shopMg" && <Card.Text>Shop manager</Card.Text>}
            </Card.Body>
            <Button
              className="edit-profile"
              variant="link"
              size="lg"
              onClick={handleShow}
              aria-label="Edit profile"
            >
              <GrEdit />
            </Button>
          </Card>
          <Button className="my-5" onClick={logMeOut}>
            Log out
          </Button>
        </Container>
      ) : status === "guest" ? (
        <Login />
      ) : null}
      <AccountOffCanvas show={show} handleClose={handleClose} />
    </>
  );
};

export default Account;
