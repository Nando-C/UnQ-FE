import type { IShop, MemberRole } from "../typings/shop";
import type { IUser } from "../typings/user";
import type { RootState } from "../redux/app/store";

// What a member of a shop may do, by role: the client's copy of the API's
// table (UnQ-BE src/services/shops/roles.ts). The client decides what to draw
// before any request, so it cannot ask the server; the API publishes each
// operation's `x-ability` and `x-roles`, and scripts/contract.test.mjs checks
// this copy against them. The API still refuses on its own: a control shown
// here and refused there gets the API's 403.

// The roles a member can hold, in the ladder's order: owner (one per shop),
// manager, then the three peers below manager.
export const MEMBER_ROLES = ["owner", "manager", "till", "floor", "kitchen"] as const;
// The roles a staff route gives: every one but owner, which a hand-over gives.
export const GIVABLE_ROLES: readonly MemberRole[] = MEMBER_ROLES.filter((role) => role !== "owner");

// Who holds each ability. shop.own is the owner's alone: deleting the shop and
// handing it over.
export const ABILITIES = {
  "shop.own": ["owner"],
  "shop.edit": ["owner", "manager"],
  "menu.edit": ["owner", "manager"],
  "menu.availability": ["owner", "manager", "till", "floor", "kitchen"],
  "tables.edit": ["owner", "manager"],
  "tables.read": ["owner", "manager", "till", "floor", "kitchen"],
  "carts.fix": ["owner", "manager", "till", "floor"],
  "payments.manage": ["owner", "manager", "till"],
  "sales.read": ["owner", "manager"],
  "staff.read": ["owner", "manager", "till", "floor", "kitchen"],
} as const satisfies Record<string, readonly MemberRole[]>;
export type Ability = keyof typeof ABILITIES;

// What the signed-in account is to a shop: an administrator (never a member),
// or its member role.
export type CallerRole = "admin" | MemberRole;
// The caller's standing on a shop as the page knows it: a role; "unknown", the
// account's shops couldn't be loaded, so the controls show and the API
// refuses what it must (the rule ManagerOnly applies to the page itself); or
// undefined, no row for this shop yet (the shops still loading, or the account
// is not on it), so nothing role-dependent is drawn.
export type RoleOn = CallerRole | "unknown" | undefined;

// An administrator holds every ability; a member holds their role's; a role
// that couldn't be read holds all (the API decides); no role holds none.
export const can = (role: RoleOn, ability: Ability): boolean =>
  role === "admin" || role === "unknown" || (role !== undefined && (ABILITIES[ability] as readonly MemberRole[]).includes(role));

// The roles that hold any of these abilities, in the ladder's order.
export const holdersOf = (abilities: readonly Ability[]): MemberRole[] =>
  MEMBER_ROLES.filter((role) => abilities.some((ability) => can(role, ability)));

// The account's role on one of its own shops (as GET /shops/me answers them,
// members included): the row that names it. A shop without `members` can only
// be a fixture from before roles, read as "unknown". Not an administrator's:
// they have no row.
export const roleOnShop = (user: Pick<IUser, "_id" | "role">, shop: Pick<IShop, "members"> | undefined): RoleOn => {
  if (user.role === "admin") return "admin";
  if (!shop) return undefined;
  if (!shop.members) return "unknown";
  return shop.members.find((m) => m.userId === user._id)?.role;
};

// The caller's standing on the shop with this id, from the account's own shops
// (shops.data; the page's `selected` shop comes from the public route and has
// no members). Decided from the row's presence, never from the load status:
// every editor reloads the shops after a save while a dialog is still open,
// and the status passes through "loading" with the data intact, so keying on
// it would blank a dialog's footer mid-save.
export const selectRoleOn = (state: RootState, shopId: string | undefined): RoleOn => {
  const user = state.user.data;
  if (user.role === "admin") return "admin";
  const shop = state.shops.data.find((s) => s._id === shopId);
  if (shop) return roleOnShop(user, shop);
  return state.shops.dataStatus === "failed" ? "unknown" : undefined;
};

// Whether a caller may add, re-role or remove a member with `target`: the
// owner (or an administrator) anyone but the owner; a manager only the three
// below; the three below nobody. The API's mayHandle, as the staff routes
// decide; a role that couldn't be read is shown everything.
export const mayHandle = (caller: RoleOn, target: MemberRole): boolean =>
  target !== "owner" &&
  (caller === "owner" || caller === "admin" || caller === "unknown" || (caller === "manager" && target !== "manager"));

// The roles a caller may give someone, in the ladder's order (the role select).
export const givable = (caller: RoleOn): MemberRole[] => GIVABLE_ROLES.filter((role) => mayHandle(caller, role));

export const roleLabel: Record<MemberRole, string> = {
  owner: "Owner",
  manager: "Manager",
  till: "Till",
  floor: "Floor",
  kitchen: "Kitchen",
};
// A role the client doesn't know (a newer API's) shows as it is, not as nothing.
export const labelOf = (role: string): string => (role in roleLabel ? roleLabel[role as MemberRole] : role);

// "Owner of Cafe", "Manager at Cafe", "Till at Cafe".
export const roleAt = (role: string, shopName: string): string =>
  role === "owner" ? `Owner of ${shopName}` : `${labelOf(role)} at ${shopName}`;
