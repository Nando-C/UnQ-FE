import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios, { AxiosResponse } from "axios";
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
// Ends the session. One that had already ended (still a 401 after the refresh
// the interceptor tries) counts as logged out too.
export const logOut = createAsyncThunk("user/logOut", async () => {
    try {
        await backend.get("/auth/logout")
    } catch (err) {
        if (!(axios.isAxiosError(err) && err.response?.status === 401)) throw err
    }
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