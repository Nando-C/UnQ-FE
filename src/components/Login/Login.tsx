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
import { useHistory } from "react-router-dom";
import backend from "../../backend/backend";
import { FcGoogle } from "react-icons/fc";
import "../Register/Register.css";
import { useAppDispatch, useAppSelector } from "../../redux/app/hooks";
import { selectCartPointers } from "../../redux/slices/cartSlice";
import { fetchUserData } from "../../redux/slices/userSlice";

const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401) return "Wrong email or password";
  }
  return "Something went wrong, try again";
};

const Login = () => {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const { shopId, tableId } = useAppSelector(selectCartPointers);

  const history = useHistory();
  const dispatch = useAppDispatch();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await backend.post("/auth/login", credentials);
      dispatch(fetchUserData());
      if (tableId) {
        history.push(`/shops/${shopId}/tables/${tableId}`);
      } else {
        history.push("/");
      }
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
            src="https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png"
            rounded
            fluid
          />
        </Col>
        <Col xs={12} sm={6}>
          <Form onSubmit={handleLogin}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Email address">
                <Form.Control
                  type="email"
                  placeholder="Enter email"
                  value={credentials.email}
                  onChange={(e) =>
                    setCredentials({ ...credentials, email: e.target.value })
                  }
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
                />
              </FloatingLabel>
            </Form.Group>
            <Form.Group className="my-3">
              <p>
                Don't have an account?
                <a href={`/register`}> SignUp</a>
              </p>
            </Form.Group>
            {error && (
              <Alert className="my-3" variant="danger">
                {error}
              </Alert>
            )}
            <Button variant="primary" type="submit" disabled={loading}>
              Login
            </Button>
            <Form.Group className="my-3">
              <Button
                className="border"
                variant="light"
                as="a"
                href={`${process.env.REACT_APP_BE_URL}/auth/googleLogin`}
              >
                <FcGoogle className="me-2" size={25} />
                Login with Google
              </Button>
            </Form.Group>
          </Form>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
