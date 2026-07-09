import { Card, Container, Image, Button, Row, Col } from "react-bootstrap";
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
        <Container className="Account p-2 text-center">
          <Card className="p-2">
            <Row className="align-items-center">
              <Col sm={12} md={6}>
                <Image className="p-5" src={user.avatar} fluid roundedCircle />
              </Col>
              <Col sm={12} md={6}>
                <Card.Title className="mt-3">
                  {user.name} {user.surname}
                </Card.Title>
                <Card.Body>
                  <Card.Text>email: {user.email}</Card.Text>
                  <Card.Text>Role: {user.role}</Card.Text>
                </Card.Body>
              </Col>
            </Row>
            <Button size={"lg"} onClick={handleShow}>
              <GrEdit />
            </Button>
          </Card>
          <Button className="my-5" onClick={logMeOut}>
            LogOut
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
