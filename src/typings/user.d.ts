
export interface IUser {
    _id: string
    name: string
    // Absent on a Google account whose Google profile has no family name.
    surname?: string
    email: string
    avatar?: string
    // "shopMg" for a shop manager, "customer" otherwise ("" while signed out).
    role: string
    // False for a Google-only account; changing the email of one that has a
    // password needs it. Absent on the logged-out placeholder.
    hasPassword?: boolean
}

export type UserStatus = "idle" | "loading" | "authenticated" | "guest"

export interface IUserStore {
    data: IUser
    status: UserStatus
}