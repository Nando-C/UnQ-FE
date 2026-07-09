
export interface IUser {
    _id: string
    name: string
    surname: string
    email: string
    avatar?: string
    role: string
}

export type UserStatus = "idle" | "loading" | "authenticated" | "guest"

export interface IUserStore {
    data: IUser
    status: UserStatus
}