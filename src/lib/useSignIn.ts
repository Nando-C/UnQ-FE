import { useLocation, useNavigate } from "react-router-dom";
import { useAppSelector } from "../redux/app/hooks";
import { selectUserData, selectUserStatus } from "../redux/slices/userSlice";
import { rememberReturnTo } from "./returnTo";

// Changing an order needs an account. With no user in the store yet, whether
// the diner has one is only known once /users/me has answered: while it's
// loading (a page's first load, or just after signing in) `known` is false,
// and a control should neither act for them nor send them to sign in.
export const useSignIn = () => {
  const status = useAppSelector(selectUserStatus);
  const signedIn = !!useAppSelector(selectUserData)._id;
  const navigate = useNavigate();
  const location = useLocation();
  return {
    known: signedIn || status !== "loading",
    signedIn,
    // Sends a guest to sign in, and back to this page after.
    signInFirst: () => {
      rememberReturnTo(location.pathname);
      navigate("/login");
    },
  };
};
