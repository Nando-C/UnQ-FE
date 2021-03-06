import { Card, Container, Image, Button, Row, Col } from "react-bootstrap";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { logOut, selectUserData } from "../../../redux/slices/userSlice";
import { GrEdit } from "react-icons/gr";
import "./Account.css";
import { useState } from "react";
import AccountOffCanvas from "../AccountOffCanvas/AccountOffCanvas";
import { useHistory } from "react-router";
import Login from "../../Login/Login";

const Account = () => {
  const user = useAppSelector(selectUserData);
  const history = useHistory();
  const dispatch = useAppDispatch();

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  const logMeOut = () => {
    dispatch(logOut());
    history.push("/login");
  };

  return (
    <>
      {user._id ? (
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
      ) : (
        <Login />
      )}
      <AccountOffCanvas show={show} handleClose={handleClose} />
    </>
  );
};

export default Account;
