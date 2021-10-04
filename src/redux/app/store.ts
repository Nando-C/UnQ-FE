import { configureStore, ThunkAction, Action } from "@reduxjs/toolkit"
import shopReducer from "../slices/shopSlice"
import userReducer from "../slices/userSlice"

export const store = configureStore({
    reducer: {
        user: userReducer,
        shops: shopReducer,
    },
})

export type AppDispatch = typeof store.dispatch
export type RootState = ReturnType<typeof store.getState>
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action<string>>