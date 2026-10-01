import { FormEvent, useEffect, useState } from "react";
import axios from "axios";
import { Form, Button, FloatingLabel, Alert } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";
import backend from "../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../redux/app/hooks";
import { selectCartPointers } from "../../redux/slices/cartSlice";
import { fetchUserData } from "../../redux/slices/userSlice";
import { peekReturnTo, rememberReturnTo, takeReturnTo } from "../../lib/returnTo";
import { tablePath } from "../../lib/paths";
import { usePageTitle } from "../../lib/usePageTitle";
import { apiErrorMessage } from "../../lib/errors";
import { AuthLayout, GoogleButton } from "./AuthLayout";

// A 401 is a wrong email or password; anything else is what the BE said (e.g.
// what's wrong with the form), as on sign-up.
const getErrorMessage = (err: unknown): string =>
  axios.isAxiosError(err) && err.response?.status === 401
    ? "Wrong email or password"
    : apiErrorMessage(err);

const Login = () => {
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
  });
  const { shopId, tableId } = useAppSelector(selectCartPointers);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  usePageTitle("Log in");

  // Sent here from a page that needs signing in (a manager's shop page): back
  // to it afterwards. Otherwise, came here from a table: whichever way they
  // sign in (this form, sign-up, Google), they go back to it afterwards. A
  // page of that same table saved on the way (its cart) is kept; any other,
  // left by an earlier sign-in that wasn't finished, is replaced.
  const sentFrom = (useLocation().state as { returnTo?: string } | null)?.returnTo;
  useEffect(() => {
    if (sentFrom) {
      rememberReturnTo(sentFrom);
      return;
    }
    if (!tableId) return;
    const table = tablePath(shopId, tableId);
    const saved = peekReturnTo();
    if (saved !== table && !saved?.startsWith(`${table}/`)) rememberReturnTo(table);
  }, [sentFrom, shopId, tableId]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await backend.post("/auth/login", credentials);
      dispatch(fetchUserData());
      // In place of this page, so Back (and a page's own back) never lands on
      // the sign-in form again.
      navigate(takeReturnTo() ?? "/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Log in">
      <Form onSubmit={handleLogin}>
        <Form.Group className="mb-3">
          <FloatingLabel controlId="login-email" label="Email address">
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
          <FloatingLabel controlId="login-password" label="Password">
            <Form.Control
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={credentials.password}
              onChange={(e) =>
                setCredentials({ ...credentials, password: e.target.value })
              }
            />
          </FloatingLabel>
        </Form.Group>
        <Form.Group className="my-3">
          <p>
            Don't have an account?{" "}
            {/* Padded to a 24px+ tap height; still reads as a link. */}
            <Link to="/register" replace className="d-inline-block py-1">
              Sign up
            </Link>
          </p>
        </Form.Group>
        {error && (
          <Alert className="my-3" variant="danger">
            {error}
          </Alert>
        )}
        <Button variant="primary" type="submit" disabled={loading}>
          Log in
        </Button>
        <Form.Group className="my-3">
          <GoogleButton label="Log in with Google" />
        </Form.Group>
      </Form>
    </AuthLayout>
  );
};

export default Login;
