import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { AxiosResponse } from "axios";
import backend from "../../backend/backend";
import { IUser, IUserStore } from "../../typings/user";
import { RootState } from "../app/store";

const emptyUser: IUser = {
    _id: "",
    name: "",
    surname: "",
    email: "",
    avatar: "",
    role: "",
}

const initialState: IUserStore = {
    data: emptyUser,
    status: "idle",
}

export const fetchUserData = createAsyncThunk("user/fetchUserData", async () => {
    const { data }: AxiosResponse<IUser> = await backend.get("users/me")
    return data
})
export const logOut = createAsyncThunk("user/logOut", async () => {
    const { data } = await backend.get("/auth/logout")
    return data
})

export const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchUserData.pending, (state) => {
            state.status = "loading"
        })
        builder.addCase(fetchUserData.fulfilled, (state, action) => {
            state.data = action.payload
            state.status = "authenticated"
        })
        builder.addCase(fetchUserData.rejected, (state) => {
            state.data = emptyUser
            state.status = "guest"
        })
        builder.addCase(logOut.fulfilled, (state) => {
            state.data = emptyUser
            state.status = "guest"
        })
    }
})

export const selectUserData = (state: RootState) => state.user.data
export const selectUserStatus = (state: RootState) => state.user.status

export default userSlice.reducer