import { IStaffMember, MemberRole } from "../typings/shop";
import { RoleOn, givable, labelOf, mayHandle } from "./roles";

// The Staff section's rules, as the API has them: the client shows the controls
// the caller's role allows and the API answers (its refusals show as they are).
// Who the caller is to the shop comes from lib/roles.ts (selectRoleOn).

// Whether the caller sees Add staff. The API lets a manager add the three
// roles below manager, but the dialog gives one role, manager, until it has a
// role select (the next step), so for now only the owner (or an administrator)
// adds; a role that couldn't be read is shown everything, as everywhere.
export const runsStaff = (caller: RoleOn) => caller === "owner" || caller === "admin" || caller === "unknown";
// The roles the caller may give, for that select (lib/roles.ts givable).
export { givable };

// The owner is never removed (the shop is handed over first); anyone may leave;
// otherwise the caller must be allowed to handle the member's role (the API's
// rule, lib/roles.ts mayHandle). A member whose account is gone has no id to
// name, so the API can't be asked (see known-gaps.md).
export const mayRemove = (caller: RoleOn, member: IStaffMember, selfId: string) =>
  member.role !== "owner" && !!member.userId && (member.userId === selfId || mayHandle(caller, member.role));

// Only a manager with an account can be made the owner, by the owner or an administrator.
export const mayMakeOwner = (caller: RoleOn, member: IStaffMember) =>
  (caller === "owner" || caller === "admin" || caller === "unknown") && member.role === "manager" && !!member.userId;

// "manager", "on the till", "on the floor", "in the kitchen": where a member
// now works, in a sentence.
export const roleIn = (role: MemberRole) =>
  role === "till" ? "on the till" : role === "floor" ? "on the floor" : role === "kitchen" ? "in the kitchen" : `a ${labelOf(role).toLowerCase()}`;

export const memberName = (member: Pick<IStaffMember, "name" | "surname" | "email">) =>
  member.name ? [member.name, member.surname].filter(Boolean).join(" ") : (member.email ?? "An account that was deleted");
export const firstName = (member: Pick<IStaffMember, "name" | "email">) => member.name ?? member.email ?? "this member";
// The row's button, named for a screen reader.
export const manageLabel = (member: Pick<IStaffMember, "name" | "surname" | "email">) =>
  member.name || member.email ? `Manage ${memberName(member)}` : "Manage a deleted account";

export { roleLabel, labelOf } from "./roles";

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

export const handOverMessage = (member: IStaffMember, shopName: string, caller: RoleOn, owner: IStaffMember | undefined) =>
  `Make ${firstName(member)} the owner of ${shopName}? ` +
  (caller === "admin"
    ? `${owner ? firstName(owner) : "The current owner"} becomes a manager.`
    : "You become a manager and can no longer delete the shop or remove managers.");

// What Add staff did, from the API's answer: created an account (201), or
// attached one that existed (200).
export const addedMessage = (member: IStaffMember, created: boolean, shopName: string) =>
  created
    ? `Account created for ${firstName(member)}. Give them the password you set; they can change it on their account page.`
    : `${firstName(member)} already had an account and is now ${roleIn(member.role)} at ${shopName}.`;
