import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { AxiosResponse } from "axios";
import { apiStatus } from "../../lib/errors";
import backend, { sessionUnknown } from "../../backend/backend";
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

// Rejects with `signedOut: true` when the BE says there's no session (401) or
// no such account any more (404); otherwise (a network error, a server fault,
// a session the refresh couldn't speak for) nothing is known about it.
let userChecks = 0
export const fetchUserData = createAsyncThunk<IUser, void, { rejectValue: { signedOut: boolean } }>(
    "user/fetchUserData",
    async (_, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<IUser> = await backend.get("users/me")
            return data
        } catch (err) {
            const status = apiStatus(err)
            return rejectWithValue({ signedOut: (status === 401 && !sessionUnknown(err)) || status === 404 })
        }
    },
    { idGenerator: () => String(++userChecks) }
)
// Ends the session. One that had already ended (still a 401 after the refresh
// the interceptor tries) counts as logged out too; not one the refresh couldn't
// speak for (see sessionUnknown).
export const logOut = createAsyncThunk("user/logOut", async () => {
    try {
        await backend.get("/auth/logout")
    } catch (err) {
        if (!(apiStatus(err) === 401 && !sessionUnknown(err))) throw err
    }
})

export const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchUserData.pending, (state, action) => {
            state.latestCheck = Number(action.meta.requestId)
            state.status = "loading"
        })
        // Who is signed in, as of when it was asked: applied unless a newer
        // answer already was (or a logout came after it was sent).
        builder.addCase(fetchUserData.fulfilled, (state, action) => {
            const check = Number(action.meta.requestId)
            if (check <= (state.decidedCheck ?? 0)) return
            state.decidedCheck = check
            state.data = action.payload
            state.status = "authenticated"
        })
        // A failure counts only from the latest check sent (an older one failing
        // late says nothing a newer one hasn't). Only the BE saying there's no
        // session signs the user out; a check that failed otherwise keeps who
        // was already known (a dropped connection doesn't sign a manager out).
        // With no one known, it's a guest.
        builder.addCase(fetchUserData.rejected, (state, action) => {
            const check = Number(action.meta.requestId)
            if (state.latestCheck !== undefined && check !== state.latestCheck) return
            // Only an answer about the session decides it: an older check's
            // success arriving after a blip still counts.
            if (action.payload?.signedOut) state.decidedCheck = check
            if (!action.payload?.signedOut && state.data._id) {
                state.status = "authenticated"
                return
            }
            state.data = emptyUser
            state.status = "guest"
        })
        builder.addCase(logOut.fulfilled, (state) => {
            state.data = emptyUser
            state.status = "guest"
            state.decidedCheck = state.latestCheck
        })
    }
})

export const selectUserData = (state: RootState) => state.user.data
export const selectUserStatus = (state: RootState) => state.user.status

export default userSlice.reducer