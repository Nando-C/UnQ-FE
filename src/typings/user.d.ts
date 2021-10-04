
export interface IUser {
    _id: string
    name: string
    surname: string
    email: string
    password?: string
    avatar?: string
    role: string
    refreshToken?: string
    googleId?: string
}

export interface IUserStore {
    data: IUser
}