import { IShop } from "../typings/shop";
import { IUser } from "../typings/user";
import { roleAt, roleOnShop } from "./roles";

// Who runs shops, read from the account's role and the shops it is a member
// of (GET /shops/me). The client never decides what an account may do on a
// shop: it shows the controls and the API answers.

// A role that gets the manager shell before the shops have loaded: a shop
// manager (may create shops) or an administrator (every shop).
export const isManagerRole = (role: string) => role === "shopMg" || role === "admin";

// Only these two roles create shops; a member of someone else's shop doesn't.
export const canCreateShops = (role: string) => isManagerRole(role);

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// The account page's line under the email: nothing for a diner; otherwise what
// the account is, from its role and its shops. An administrator is never a
// member, so their shops (every shop) don't count. The shops say more than the
// role, so they win: a shop manager with no shop yet is "Shop manager", one on
// a shop is named by their role there ("Owner of Cafe", "Till at Cafe"), and
// one on several "Manages 2 shops" when they own or manage each, else "Staff
// at 2 shops".
export const roleLine = (user: Pick<IUser, "_id" | "role">, shops: IShop[]): string | null => {
  if (user.role === "admin") return "Administrator";
  if (shops.length === 0) return user.role === "shopMg" ? "Shop manager" : null;
  const roles = shops.map((shop) => roleOnShop(user, shop));
  if (shops.length > 1) {
    const runs = roles.every((role) => role === "owner" || role === "manager" || role === "unknown");
    return `${runs ? "Manages" : "Staff at"} ${count(shops.length, "shop")}`;
  }
  const [role] = roles;
  // A shop without members (from before roles): the owner is known by ownerId.
  const legacy = shops[0].ownerId === user._id ? "owner" : "manager";
  return role === undefined ? `Staff at ${shops[0].name}` : roleAt(role === "unknown" ? legacy : role, shops[0].name);
};
