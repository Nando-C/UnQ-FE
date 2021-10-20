import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { AxiosResponse } from "axios"
import backend from "../../backend/backend"
import { IMenu } from "../../typings/menu";
import { IShop, IShopStore } from "../../typings/shop"
import { RootState } from "../app/store";

const initialState: IShopStore = {
    data: [],
    selected: null,
    selectedMenu: null,
}

export const fetchAllShops = createAsyncThunk("shop/fetchAllShops", async () => {
    const { data }: AxiosResponse<IShop[]> = await backend.get("/shops/")
    return data
})

export const fetchShopList = createAsyncThunk("shop/fetchShopList", async () => {
    const { data }: AxiosResponse<IShop[]> = await backend.get("/shops/me")
    return data
})

export const fetchSingleShop = createAsyncThunk("shop/fetchSingleShop", async (shopId: string) => {
    const { data }: AxiosResponse<IShop> = await backend.get(`/shops/${shopId}`)
    return data
})

interface FetchMenuItemProps {
    itemId: string 
    shopId: string
}
export const fetchMenuItem = createAsyncThunk("shop/fetchMenuItem", async ({shopId, itemId}: FetchMenuItemProps ) => {
    const { data }: AxiosResponse<IMenu> = await backend.get(`/shops/${shopId}/menu/${itemId}`)
    return data
})

export const shopsSlice = createSlice({
    name: "shops",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder.addCase(fetchAllShops.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(fetchShopList.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(fetchSingleShop.fulfilled, (state, action) => {
            state.selected = action.payload
        })
        builder.addCase(fetchMenuItem.fulfilled, (state, action) => {
            state.selectedMenu = action.payload
        })
    }
})

export const selectShopsData = (state: RootState) => state.shops.data
export const selectSelectedShop = (state: RootState) => state.shops.selected
export const selectSelectedMenu = (state: RootState) => state.shops.selectedMenu

export default shopsSlice.reducer