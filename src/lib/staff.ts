import { IShop, IStaffMember, MemberRole } from "../typings/shop";
import { IUser } from "../typings/user";

// The Staff section's rules, as the API has them: the client shows the controls
// the caller's role allows and the API answers (its refusals show as they are).

// What the signed-in account is to the shop: an administrator (never a
// member), the owner, or a manager (any other member).
export type CallerRole = "admin" | MemberRole;
export const callerRoleOn = (user: Pick<IUser, "_id" | "role">, shop: Pick<IShop, "ownerId">): CallerRole =>
  user.role === "admin" ? "admin" : shop.ownerId === user._id ? "owner" : "manager";

// Whether the caller handles managers: adds them, removes them, hands over.
export const runsStaff = (caller: CallerRole) => caller === "owner" || caller === "admin";

// The owner is never removed (the shop is handed over first); the owner or an
// administrator removes anyone else; anyone may leave. A member whose account
// is gone has no id to name, so the API can't be asked (see known-gaps.md).
export const mayRemove = (caller: CallerRole, member: IStaffMember, selfId: string) =>
  member.role !== "owner" && !!member.userId && (runsStaff(caller) || member.userId === selfId);

// Only a manager with an account can be made the owner, by the owner or an administrator.
export const mayMakeOwner = (caller: CallerRole, member: IStaffMember) =>
  runsStaff(caller) && member.role === "manager" && !!member.userId;

export const memberName = (member: Pick<IStaffMember, "name" | "surname" | "email">) =>
  member.name ? [member.name, member.surname].filter(Boolean).join(" ") : (member.email ?? "An account that was deleted");
export const firstName = (member: Pick<IStaffMember, "name" | "email">) => member.name ?? member.email ?? "this member";
// The row's button, named for a screen reader.
export const manageLabel = (member: Pick<IStaffMember, "name" | "surname" | "email">) =>
  member.name || member.email ? `Manage ${memberName(member)}` : "Manage a deleted account";

export const roleLabel: Record<MemberRole, string> = { owner: "Owner", manager: "Manager" };

// "12 Oct 2026": memberships last for years, so the year is kept.
export const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

// Who added a member, when they are still on the staff (an administrator who
// did isn't, so nothing is said).
export const addedByName = (member: IStaffMember, members: IStaffMember[]) => {
  const by = member.addedBy && members.find((m) => m.userId === member.addedBy);
  return by ? firstName(by) : null;
};

// The questions asked before a change (ConfirmFooter), saying what follows.
export const removeMessage = (member: IStaffMember, shopName: string, self: boolean) =>
  self
    ? `Leave ${shopName}? You keep your account and lose access to this shop on your next request.`
    : `Remove ${firstName(member)} from ${shopName}? They keep their account and lose access to this shop on their next request.`;

export const handOverMessage = (member: IStaffMember, shopName: string, caller: CallerRole, owner: IStaffMember | undefined) =>
  `Make ${firstName(member)} the owner of ${shopName}? ` +
  (caller === "admin"
    ? `${owner ? firstName(owner) : "The current owner"} becomes a manager.`
    : "You become a manager and can no longer delete the shop or remove managers.");

// What Add staff did, from the API's answer: created an account (201), or
// attached one that existed (200).
export const addedMessage = (member: IStaffMember, created: boolean, shopName: string) =>
  created
    ? `Account created for ${firstName(member)}. Give them the password you set; they can change it on their account page.`
    : `${firstName(member)} already had an account and is now a manager at ${shopName}.`;
