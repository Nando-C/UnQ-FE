import { IListedUser } from "../typings/user";

// The administrator's Accounts page: wording and the two rules the client
// shows before the API does (its refusals show as they are).

export const ACCOUNT_ROLES = ["customer", "shopMg", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export const accountRoleLabel: Record<AccountRole, string> = {
  customer: "Customer",
  shopMg: "Shop manager",
  admin: "Administrator",
};
export const isAccountRole = (role: string): role is AccountRole => (ACCOUNT_ROLES as readonly string[]).includes(role);

export const accountName = (account: Pick<IListedUser, "name" | "surname">) => [account.name, account.surname].filter(Boolean).join(" ");

// "Owner of Cafe, manager at Deli", or "no shops".
export const shopsLine = (shops: IListedUser["shops"]) =>
  shops.length === 0
    ? "no shops"
    : shops
        .map(({ name, role }, i) => {
          const part = role === "owner" ? `owner of ${name}` : `manager at ${name}`;
          return i === 0 ? part[0].toUpperCase() + part.slice(1) : part;
        })
        .join(", ");

// The question before deleting, saying what follows and what the API will
// refuse: an account that owns a shop isn't deleted until the shop is handed
// over or deleted.
export const deleteAccountMessage = (account: IListedUser) => {
  const owned = account.shops.filter((shop) => shop.role === "owner").map((shop) => shop.name);
  const base = `Delete ${account.name}'s account? Their sign-ins end and they leave the shops they work at.`;
  if (owned.length === 0) return base;
  return `${base} They own ${owned.join(" and ")}: hand ${owned.length === 1 ? "it" : "them"} over or delete ${owned.length === 1 ? "it" : "them"} first.`;
};

export const createdMessage = (account: { name: string }) =>
  `Account created for ${account.name}. Give them the password you set; they can change it on their account page.`;
