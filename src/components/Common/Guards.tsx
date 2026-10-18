import { ReactNode, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../redux/app/hooks";
import { selectUserData, selectUserStatus } from "../../redux/slices/userSlice";
import { loadShopList, selectIsManager, selectShopsDataStatus } from "../../redux/slices/shopSlice";
import { rememberReturnTo } from "../../lib/returnTo";
import { HeadingPlaceholder, Loading } from "./ScreenStates";

// A manager's page. A guest is sent to sign in (and back here after), and a
// diner to the shop list. Until it's known who is signed in the page shows,
// as it's nearly always a manager opening it. A signed-in account without the
// manager role may still be a member of a shop: its shops say, so the page
// waits for them (a member who opens their shop's address directly isn't sent
// home while the answer is on its way); if they can't be loaded the page
// shows and the API refuses what it must.
export const ManagerOnly = ({ children }: { children: ReactNode }) => {
  const status = useAppSelector(selectUserStatus);
  const isManager = useAppSelector(selectIsManager);
  const shopsStatus = useAppSelector(selectShopsDataStatus);
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (status === "authenticated") dispatch(loadShopList());
  }, [status, dispatch]);

  if (status === "guest") return <SignInFirst />;
  if (status !== "authenticated" || isManager) return <>{children}</>;
  if (shopsStatus === "ready") return <Navigate to="/" replace />;
  if (shopsStatus === "failed") return <>{children}</>;
  return (
    <Loading label="Loading your shops">
      <div className="page-head">
        <h1>
          <HeadingPlaceholder />
        </h1>
      </div>
    </Loading>
  );
};

// An administrator's page: everyone else signed in is sent to the home page,
// a guest to sign in. Until it's known who is signed in the page shows.
export const AdminOnly = ({ children }: { children: ReactNode }) => {
  const status = useAppSelector(selectUserStatus);
  const { role } = useAppSelector(selectUserData);

  if (status === "guest") return <SignInFirst />;
  if (status === "authenticated" && role !== "admin") return <Navigate to="/" replace />;
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
