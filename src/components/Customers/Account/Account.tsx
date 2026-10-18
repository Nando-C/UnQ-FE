import { Alert, Card, Container, Image, Button } from "react-bootstrap";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { logOut, selectUserData, selectUserStatus } from "../../../redux/slices/userSlice";
import { GrEdit } from "react-icons/gr";
import "./Account.css";
import { useState } from "react";
import AccountOffCanvas from "../AccountOffCanvas/AccountOffCanvas";
import Devices from "./Devices";
import { useNavigate } from "react-router-dom";
import Login from "../../Login/Login";
import { usePageTitle } from "../../../lib/usePageTitle";
import { takeReturnTo } from "../../../lib/returnTo";
import { roleLine } from "../../../lib/membership";
import { selectShopsData, selectShopsDataStatus } from "../../../redux/slices/shopSlice";

const Account = () => {
  const user = useAppSelector(selectUserData);
  const status = useAppSelector(selectUserStatus);
  const shops = useAppSelector(selectShopsData);
  const shopsStatus = useAppSelector(selectShopsDataStatus);
  // What the account is (lib/membership.ts), once its shops have answered (or
  // couldn't), so the line doesn't change under the reader; an administrator's
  // doesn't depend on them.
  const line = user.role === "admin" || shopsStatus === "ready" || shopsStatus === "failed" ? roleLine(user, shops) : null;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  // A guest sees the sign-in form here, which names the page itself.
  usePageTitle(status === "guest" ? "Log in" : "Account");

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  // Only once the session has ended: if it hasn't, they're still signed in
  // and are told so, rather than shown the sign-in form.
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const logMeOut = async () => {
    setLogoutFailed(false);
    setLoggingOut(true);
    try {
      await dispatch(logOut()).unwrap();
      // Whoever signs in next starts afresh, not at this account's table.
      takeReturnTo();
      navigate("/login");
    } catch {
      setLogoutFailed(true);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      {status === "authenticated" ? (
        <Container className="Account phone-column px-2 pb-2 text-center">
          <h1 className="visually-hidden">Account</h1>
          <Card className="p-2">
            {/* One column at every width (the page is a phone-width column
                on wide screens too), so the corner edit button never sits
                over the name. */}
            <div>
              <Image className="avatar my-4" src={user.avatar} alt="" roundedCircle />
            </div>
            <Card.Title as="h2" className="h5">
              {user.name} {user.surname}
            </Card.Title>
            <Card.Body>
              <Card.Text className="text-break">{user.email}</Card.Text>
              {/* Diners aren't shown a role; whoever runs shops sees which,
                  and as what. */}
              {line && <Card.Text>{line}</Card.Text>}
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
          <Devices />
          <Button className="my-5" onClick={logMeOut} disabled={loggingOut}>
            Log out
          </Button>
          {logoutFailed && (
            <Alert variant="danger">
              Couldn't log out. Check your connection and try again.
            </Alert>
          )}
        </Container>
      ) : status === "guest" ? (
        <Login />
      ) : null}
      <AccountOffCanvas show={show} handleClose={handleClose} />
    </>
  );
};

export default Account;
