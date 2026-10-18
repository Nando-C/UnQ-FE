
import { MemberRole } from "./shop";

export interface IUser {
    _id: string
    name: string
    // Absent on a Google account whose Google profile has no family name.
    surname?: string
    email: string
    avatar?: string
    // "customer", "shopMg" (a shop manager: may create shops) or "admin" (may
    // do everything on every shop and manage accounts); "" while signed out.
    role: string
    // Who made the account when it wasn't the person: an administrator, or a
    // shop's owner adding staff. Absent on a self-registered account.
    createdBy?: string
    // False for a Google-only account; changing the email of one that has a
    // password needs it. Absent on the logged-out placeholder.
    hasPassword?: boolean
}

// An account as the administrator's list gives it (GET /users), with the shops
// it is a member of and its role on each.
export interface IListedUser extends IUser {
    createdAt: string
    updatedAt: string
    shops: { _id: string; name: string; role: MemberRole }[]
}

export type UserStatus = "idle" | "loading" | "authenticated" | "guest"

export interface IUserStore {
    data: IUser
    status: UserStatus
    // "Who am I" checks are numbered as they're sent (several go out at once on
    // a page load). The latest one sent: only its failure counts.
    latestCheck?: number
    // The one whose answer was applied last: an older success doesn't undo it.
    // Logging out sets it to the latest sent, so a check sent before can't sign
    // the user back in.
    decidedCheck?: number
}
// A device the account is signed in on (GET /auth/sessions).
export interface ISession {
    _id: string
    createdAt: string
    lastUsedAt: string
    // The browser's User-Agent at sign-in; absent when it sent none.
    userAgent?: string
    // Whether this is the device asking.
    current: boolean
}
