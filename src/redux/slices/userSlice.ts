import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { AxiosResponse } from "axios";
import backend from "../../backend/backend";
import { IUser, IUserStore } from "../../typings/user";
import { RootState } from "../app/store";

const initialState: IUserStore = {
   data: {
    _id: "",
    name: "",
    surname: "",
    email: "",
    password: "",
    avatar: "",
    role: "",
    refreshToken: "",
    googleId: "",
   },
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
        builder.addCase(fetchUserData.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(logOut.fulfilled, (state, action) => {
            state.data = {
                _id: "",
                name: "",
                surname: "",
                email: "",
                password: "",
                avatar: "",
                role: "",
                refreshToken: "",
                googleId: "",
               }
        })
    }
})

export const selectUserData = (state: RootState) => state.user.data

export default userSlice.reducer