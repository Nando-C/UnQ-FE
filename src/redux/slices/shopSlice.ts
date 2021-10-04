import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { AxiosResponse } from "axios"
import backend from "../../backend/backend"
import { IShop, IShopStore } from "../../typings/shop"
import { RootState } from "../app/store";

const initialState: IShopStore = {
    data: [],
}

export const fetchShopList = createAsyncThunk("shop/fetchShopList", async () => {
    const { data }: AxiosResponse<IShop[]> = await backend.get("/shops")
    return data
})

export const shopsSlice = createSlice({
    name: "shops",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchShopList.fulfilled, (state, action) => {
            state.data = action.payload
        })
    }
})

export const selectShopsData = (state: RootState) => state.shops.data

export default shopsSlice.reducer