import { FormEvent, useState } from "react";
import axios from "axios";
import {
  Col,
  Container,
  Form,
  Row,
  Button,
  FloatingLabel,
  Image,
  Alert,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import backend from "../../backend/backend";
import { useAppDispatch } from "../../redux/app/hooks";
import { fetchUserData } from "../../redux/slices/userSlice";
import wordmark from "../../assets/unq-wordmark-onematerial.svg";
import "./Register.css";
import { takeReturnTo } from "../../lib/returnTo";

const MIN_PASSWORD_LENGTH = 8;

const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 409) return "Email already registered";
    const data = err.response?.data as
      | { message?: string; details?: { message: string }[] }
      | undefined;
    if (data?.details?.length) return data.details.map((d) => d.message).join(", ");
    if (data?.message) return data.message;
  }
  return "Something went wrong, try again";
};

const Register = () => {
  const [credentials, setCredentials] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
  });

  const [verifyPassword, setVerifyPassword] = useState("");
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

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
      navigate(takeReturnTo() ?? "/");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="Register mb-5 text-center">
      <Row className="align-items-center">
        <Col xs={12} sm={6}>
          <Image
            src={wordmark}
            alt="UnQ"
            fluid
            style={{ maxWidth: "22rem" }}
          />
        </Col>
        <Col xs={12} sm={6}>
          <Form onSubmit={handleSignUp}>
            <Row>
              <Col>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <FloatingLabel controlId="floatingInput" label="First Name">
                    <Form.Control
                      placeholder="First name"
                      value={credentials.name}
                      onChange={(e) =>
                        setCredentials({ ...credentials, name: e.target.value })
                      }
                      isValid={credentials.name.length > 1}
                    />
                  </FloatingLabel>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3" controlId="formBasicEmail">
                  <FloatingLabel controlId="floatingInput" label="Last Name">
                    <Form.Control
                      placeholder="Last name"
                      value={credentials.surname}
                      onChange={(e) =>
                        setCredentials({
                          ...credentials,
                          surname: e.target.value,
                        })
                      }
                      isValid={credentials.surname.length > 1}
                    />
                  </FloatingLabel>
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Email address">
                <Form.Control
                  type="email"
                  placeholder="Enter email"
                  value={credentials.email}
                  onChange={(e) =>
                    setCredentials({ ...credentials, email: e.target.value })
                  }
                  isValid={credentials.email.split("@").length === 2}
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicPassword">
              <FloatingLabel controlId="floatingPassword" label="Password">
                <Form.Control
                  type="password"
                  placeholder="Password"
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({ ...credentials, password: e.target.value })
                  }
                  isValid={
                    verifyPassword === credentials.password &&
                    verifyPassword !== ""
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="mb-3" controlId="formBasicPassword">
              <FloatingLabel
                controlId="floatingPassword"
                label="Re-type Password"
              >
                <Form.Control
                  type="password"
                  placeholder="Re-type Password"
                  value={verifyPassword}
                  onChange={(e) => setVerifyPassword(e.target.value)}
                  isInvalid={
                    verifyPassword === credentials.password ? false : true
                  }
                  isValid={
                    verifyPassword === credentials.password &&
                    verifyPassword !== ""
                  }
                />
              </FloatingLabel>
            </Form.Group>
            <Button variant="primary" type="submit" disabled={loading}>
              SignUp
            </Button>
            {error && (
              <Alert className="my-3" variant="danger">
                {error}
              </Alert>
            )}
          </Form>
        </Col>
      </Row>
    </Container>
  );
};

export default Register;
