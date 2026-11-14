import { matchPath } from "react-router-dom";
import { useAppSelector } from "../redux/app/hooks";
import { selectIsManager, selectShopsData, selectShopsDataStatus } from "../redux/slices/shopSlice";
import { selectSignedOut, selectUserData, selectUserStatus } from "../redux/slices/userSlice";
import { isManagerRole } from "./membership";

// Which shell an account gets: the manager header for whoever runs a shop, the
// bottom tab bar for everyone else. That is only known once the session has
// answered and, for an account without a manager role, its shops have too. A
// reloaded page would draw the diner's shell until then and swap it under the
// reader, so the last answer is kept in localStorage and stands in meanwhile.
// It is a layout hint and nothing more: it holds no identity, grants nothing
// (the guards and the API decide what a page shows), and is corrected as soon
// as the answers arrive.
const KEY = "unq.shell";

export const rememberedStaffShell = (): boolean => {
  try {
    return localStorage.getItem(KEY) === "staff";
  } catch {
    // No storage (private mode, blocked): the shell is drawn once it is known.
    return false;
  }
};

export const rememberShell = (staff: boolean) => {
  try {
    if (staff) localStorage.setItem(KEY, "staff");
    else localStorage.removeItem(KEY);
  } catch {
    // Nothing kept: the next load starts from the diner's shell.
  }
};

// Whether the account runs shops (`runsShops`): a guest doesn't, a manager
// role does, and anyone else is answered by their shops (not at all if they
// couldn't be loaded, as before they were asked for). Until that is settled,
// what was true the last time it was known. The account counts as known while
// it is held, through a later "who am I" too (the home page asks again each
// time it opens), so the shell never falls back to the memory mid-session.
// `toRemember` is the answer worth keeping for the next load, or null when
// this one says nothing lasting: shops that failed to load, or a guest only
// because the API couldn't be reached.
export const useRunsShops = (): { runsShops: boolean; toRemember: boolean | null } => {
  const status = useAppSelector(selectUserStatus);
  const user = useAppSelector(selectUserData);
  const shopsStatus = useAppSelector(selectShopsDataStatus);
  const hasShops = useAppSelector(selectShopsData).length > 0;
  const isManager = useAppSelector(selectIsManager);
  const signedOut = useAppSelector(selectSignedOut);
  const signedIn = !!user._id;
  const shopsKnown = isManagerRole(user.role) || hasShops || shopsStatus === "ready";
  const settled = status === "guest" || (signedIn && (shopsKnown || shopsStatus === "failed"));
  return {
    runsShops: settled ? isManager : rememberedStaffShell(),
    toRemember: signedIn && shopsKnown ? isManager : signedOut ? false : null,
  };
};

// The diner's pages, as the routes name them (App.tsx draws its routes from
// these): a shop's menu before a table is picked, a table's menu, and its
// cart. They get the diner's shell whoever is signed in, since the cart is
// reached from the tab bar and all three are laid out around it.
export const DINER_ROUTES = {
  shopMenu: "/customer/shop/:shopId",
  tableMenu: "/shops/:shopId/tables/:tableId",
  cart: "/shops/:shopId/tables/:tableId/cart",
} as const;

export const isDinerPage = (pathname: string) =>
  Object.values(DINER_ROUTES).some((path) => matchPath({ path, end: true }, pathname) !== null);
