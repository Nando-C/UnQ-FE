import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit"
import { AxiosResponse } from "axios"
import backend from "../../backend/backend"
import { IMenu } from "../../typings/menu";
import { IShop, IShopStore } from "../../typings/shop"
import { RootState } from "../app/store";

const initialState: IShopStore = {
    all: [],
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
    reducers: {
        // Flips one menu item's availability in place, so the switch on the menu
        // card can respond to a click immediately instead of waiting out a PUT
        // plus a refetch of every shop. Item dispatches this before the request
        // and again with the previous value if the request fails.
        //
        // The value comes from the click, not the PUT response, so the switch
        // moves before the round trip; the response (the updated item) adds
        // nothing the store doesn't already hold by then.
        setMenuItemAvailability: (
            state,
            action: PayloadAction<{ shopId: string; itemId: string; available: boolean }>
        ) => {
            const { shopId, itemId, available } = action.payload
            // The same shop can be held three times — in the manager's list, in
            // every shop's, and as the currently selected one — and all back
            // live views.
            const apply = (shop: IShop | null) => {
                if (!shop || shop._id !== shopId) return
                const item = shop.menu.find((menuItem) => menuItem._id === itemId)
                if (item) item.available = available
            }
            state.data.forEach(apply)
            state.all.forEach(apply)
            apply(state.selected)
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchAllShops.pending, (state) => {
            state.allStatus = "loading"
        })
        builder.addCase(fetchAllShops.fulfilled, (state, action) => {
            state.all = action.payload
            state.allStatus = "ready"
        })
        builder.addCase(fetchAllShops.rejected, (state) => {
            state.allStatus = "failed"
        })
        builder.addCase(fetchShopList.pending, (state) => {
            state.dataStatus = "loading"
        })
        builder.addCase(fetchShopList.fulfilled, (state, action) => {
            state.data = action.payload
            state.dataStatus = "ready"
        })
        builder.addCase(fetchShopList.rejected, (state) => {
            state.dataStatus = "failed"
        })
        // Which answer becomes `selected`:
        // - one about another shop (opened before, answering late) never does,
        //   or it would replace this one and leave its page waiting;
        // - the latest request's answer always does;
        // - an older request's answer for this same shop does only while the
        //   store doesn't hold this shop yet, so it can stand in when the
        //   latest fails, but never overwrites a newer copy (after an edit,
        //   or an item selling out).
        // Only the latest request's failure counts as the shop failing to load.
        builder.addCase(fetchSingleShop.pending, (state, action) => {
            state.selectedWanted = action.meta.arg
            state.selectedRequestId = action.meta.requestId
            if (state.selectedFailed === action.meta.arg) delete state.selectedFailed
        })
        builder.addCase(fetchSingleShop.fulfilled, (state, action) => {
            if (action.meta.arg !== state.selectedWanted) return
            const latest = action.meta.requestId === state.selectedRequestId
            if (latest || state.selected?._id !== action.meta.arg) {
                state.selected = action.payload
            }
        })
        builder.addCase(fetchSingleShop.rejected, (state, action) => {
            if (action.meta.requestId !== state.selectedRequestId) return
            state.selectedFailed = action.meta.arg
        })
        builder.addCase(fetchMenuItem.fulfilled, (state, action) => {
            state.selectedMenu = action.payload
        })
    }
})

export const { setMenuItemAvailability } = shopsSlice.actions

export const selectAllShops = (state: RootState) => state.shops.all
export const selectShopsData = (state: RootState) => state.shops.data
export const selectSelectedShop = (state: RootState) => state.shops.selected
export const selectSelectedMenu = (state: RootState) => state.shops.selectedMenu
export const selectAllShopsStatus = (state: RootState) => state.shops.allStatus
export const selectShopsDataStatus = (state: RootState) => state.shops.dataStatus
export const selectSelectedFailed = (state: RootState) => state.shops.selectedFailed

export default shopsSlice.reducer