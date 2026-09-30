import { FormEvent, useState } from "react";
import axios from "axios";
import { Col, Form, Row, Button, FloatingLabel, Alert } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import backend from "../../backend/backend";
import { useAppDispatch } from "../../redux/app/hooks";
import { fetchUserData } from "../../redux/slices/userSlice";
import { takeReturnTo } from "../../lib/returnTo";
import { apiErrorMessage } from "../../lib/errors";
import { usePageTitle } from "../../lib/usePageTitle";
import { AuthLayout, GoogleButton } from "../Login/AuthLayout";

const MIN_PASSWORD_LENGTH = 8;

const getErrorMessage = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.status === 409
    ? "Email already registered"
    : apiErrorMessage(err);

const Register = () => {
  const [credentials, setCredentials] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
  });

  const [verifyPassword, setVerifyPassword] = useState("");
  // The retyped password is only judged once the diner has left the field or
  // tried to sign up, not while they're still typing either one.
  const [verifyTouched, setVerifyTouched] = useState(false);
  const mismatch = verifyTouched && verifyPassword !== credentials.password;
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  usePageTitle("Sign up");

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setVerifyTouched(true);

    if (
      !credentials.name ||
      !credentials.surname ||
      !credentials.email ||
      !credentials.password
    ) {
      setError("All fields are required");
      return;
    }
    if (credentials.password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (verifyPassword !== credentials.password) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await backend.post("/auth/register", credentials);
      dispatch(fetchUserData());
      // In place of this page, so Back never lands on the sign-up form again.
      navigate(takeReturnTo() ?? "/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign up">
      <Form onSubmit={handleSignUp}>
        <Row>
          <Col>
            <Form.Group className="mb-3">
              <FloatingLabel controlId="register-name" label="First Name">
                <Form.Control
                  placeholder="First name"
                  autoComplete="given-name"
                  value={credentials.name}
                  onChange={(e) =>
                    setCredentials({ ...credentials, name: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
          </Col>
          <Col>
            <Form.Group className="mb-3">
              <FloatingLabel controlId="register-surname" label="Last Name">
                <Form.Control
                  placeholder="Last name"
                  autoComplete="family-name"
                  value={credentials.surname}
                  onChange={(e) =>
                    setCredentials({ ...credentials, surname: e.target.value })
                  }
                />
              </FloatingLabel>
            </Form.Group>
          </Col>
        </Row>
        <Form.Group className="mb-3">
          <FloatingLabel controlId="register-email" label="Email address">
            <Form.Control
              type="email"
              placeholder="Enter email"
              autoComplete="email"
              value={credentials.email}
              onChange={(e) =>
                setCredentials({ ...credentials, email: e.target.value })
              }
            />
          </FloatingLabel>
        </Form.Group>
        <Form.Group className="mb-3">
          <FloatingLabel controlId="register-password" label="Password">
            <Form.Control
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              aria-describedby="register-password-hint"
              value={credentials.password}
              onChange={(e) =>
                setCredentials({ ...credentials, password: e.target.value })
              }
            />
          </FloatingLabel>
          <Form.Text id="register-password-hint" className="d-block text-start">
            At least {MIN_PASSWORD_LENGTH} characters.
          </Form.Text>
        </Form.Group>
        <Form.Group className="mb-3">
          <FloatingLabel controlId="register-password-again" label="Re-type Password">
            <Form.Control
              type="password"
              placeholder="Re-type Password"
              autoComplete="new-password"
              value={verifyPassword}
              onChange={(e) => setVerifyPassword(e.target.value)}
              onBlur={() => setVerifyTouched(true)}
              isInvalid={mismatch}
            />
            <Form.Control.Feedback type="invalid" className="text-start">
              Doesn't match the password above.
            </Form.Control.Feedback>
          </FloatingLabel>
        </Form.Group>
        {/* Above the button, as on the log-in page. */}
        {error && (
          <Alert className="my-3" variant="danger">
            {error}
          </Alert>
        )}
        <Button variant="primary" type="submit" disabled={loading}>
          Sign up
        </Button>
        <Form.Group className="my-3">
          <p>
            Already have an account?{" "}
            {/* Padded to a 24px+ tap height; still reads as a link. */}
            <Link to="/login" replace className="d-inline-block py-1">
              Log in
            </Link>
          </p>
          <GoogleButton label="Sign up with Google" />
        </Form.Group>
      </Form>
    </AuthLayout>
  );
};

export default Register;
