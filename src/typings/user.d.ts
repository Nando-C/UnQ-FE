
export interface IUser {
    _id: string
    name: string
    surname: string
    email: string
    avatar?: string
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