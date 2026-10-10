import { ReactNode, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "../../redux/app/hooks";
import { selectUserData, selectUserStatus } from "../../redux/slices/userSlice";
import { rememberReturnTo } from "../../lib/returnTo";

// A manager's page. A guest is sent to sign in (and back here after), and a
// diner to the shop list. Until it's known who is signed in the page shows,
// as it's nearly always a manager opening it.
export const ManagerOnly = ({ children }: { children: ReactNode }) => {
  const status = useAppSelector(selectUserStatus);
  const { role } = useAppSelector(selectUserData);

  if (status === "guest") return <SignInFirst />;
  if (status === "authenticated" && role !== "shopMg") return <Navigate to="/" replace />;
  return <>{children}</>;
};

const SignInFirst = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    // Saved for a Google sign-in (which comes back to the site root), and
    // handed to the sign-in page, which keeps it over a table.
    rememberReturnTo(pathname);
    navigate("/login", { replace: true, state: { returnTo: pathname } });
  }, [navigate, pathname]);
  return null;
};
