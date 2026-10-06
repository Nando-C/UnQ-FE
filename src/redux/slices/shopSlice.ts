import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit"
import { AxiosResponse } from "axios"
import backend from "../../backend/backend"
import { IMenu } from "../../typings/menu";
import { IShop, IShopPage, IShopStore } from "../../typings/shop"
import { RootState } from "../app/store";
import { logOut } from "./userSlice";

const initialState: IShopStore = {
    all: [],
    data: [],
    selected: null,
    selectedMenu: null,
}

export const SHOPS_PER_PAGE = 20
// How long the home page's shops are kept before arriving there loads them again.
export const SHOPS_FRESH_MS = 60_000

// The home page's shops, a page at a time: the first page of the search `q`
// ("" for every shop), or with `cursor` the page after it. Numbered as
// fetchSingleShop's requests are, and timed. A first page on its way, or held
// and loaded less than SHOPS_FRESH_MS ago, is not asked again (Try again,
// after a failure, is); a next page is asked one at a time, and only of the
// search last asked for.
let browseRequests = 0
export const browseShops = createAsyncThunk<
    IShopPage,
    { q: string; cursor?: string },
    { state: RootState; pendingMeta: { at: number } }
>(
    "shop/browseShops",
    async ({ q, cursor }) => {
        const { data }: AxiosResponse<IShopPage> = await backend.get("/shops/browse", {
            params: { q: q || undefined, cursor, limit: SHOPS_PER_PAGE },
        })
        return data
    },
    {
        idGenerator: () => String(++browseRequests),
        getPendingMeta: () => ({ at: Date.now() }),
        condition: ({ q, cursor }, { getState }) => {
            const { shops } = getState()
            if (cursor) return shops.allMoreStatus !== "loading" && q === shops.allWanted
            if (shops.allWanted !== q) return true
            const fresh = Date.now() - (shops.allLoadedAt ?? 0) < SHOPS_FRESH_MS
            return !(shops.allStatus === "loading" || (shops.allStatus === "ready" && fresh))
        },
    }
)

export const fetchShopList = createAsyncThunk("shop/fetchShopList", async () => {
    const { data }: AxiosResponse<IShop[]> = await backend.get("/shops/me")
    return data
})

// Each request for a shop is numbered in the order it was sent (its requestId),
// so the reducers can tell a newer answer from an older one.
let shopRequests = 0
export const fetchSingleShop = createAsyncThunk(
    "shop/fetchSingleShop",
    async (shopId: string) => {
        const { data }: AxiosResponse<IShop> = await backend.get(`/shops/${shopId}`)
        return data
    },
    { idGenerator: () => String(++shopRequests) }
)

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
            // The same shop can be held twice — in the manager's list and as the
            // currently selected one — and both back live views.
            const apply = (shop: IShop | null) => {
                if (!shop || shop._id !== shopId) return
                const item = shop.menu.find((menuItem) => menuItem._id === itemId)
                if (item) item.available = available
            }
            state.data.forEach(apply)
            apply(state.selected)
        },
    },
    extraReducers: (builder) => {
        // A first page counts only if it answers the search last asked for (an
        // older one, answered late, is ignored); it replaces the list. A next
        // page counts only if it continues the list held (same search, from its
        // last shop), and is added to it; one that doesn't still ends the wait
        // for a next page if it's the latest asked (so "Show more" isn't left
        // disabled), and a first page of the same search doesn't end that wait.
        builder.addCase(browseShops.pending, (state, action) => {
            if (action.meta.arg.cursor) {
                state.allMoreStatus = "loading"
                state.allMoreLatest = Number(action.meta.requestId)
                return
            }
            state.allWanted = action.meta.arg.q
            state.allLatest = Number(action.meta.requestId)
            state.allLatestAt = action.meta.at
            state.allStatus = "loading"
        })
        builder.addCase(browseShops.fulfilled, (state, action) => {
            const { q, cursor } = action.meta.arg
            if (cursor) {
                if (q !== state.allQuery || cursor !== state.allNext) {
                    if (Number(action.meta.requestId) === state.allMoreLatest) delete state.allMoreStatus
                    return
                }
                state.all.push(...action.payload.shops)
                state.allNext = action.payload.next
                state.allMoreStatus = "ready"
                return
            }
            if (Number(action.meta.requestId) !== state.allLatest) return
            // A next page still on its way is of another search's list, or of
            // this one (then it's added if it continues the new first page).
            if (q !== state.allQuery || state.allMoreStatus !== "loading") delete state.allMoreStatus
            state.all = action.payload.shops
            state.allQuery = q
            state.allNext = action.payload.next
            state.allLoadedAt = state.allLatestAt
            state.allStatus = "ready"
        })
        builder.addCase(browseShops.rejected, (state, action) => {
            const { q, cursor } = action.meta.arg
            if (cursor) {
                if (q === state.allQuery && cursor === state.allNext) state.allMoreStatus = "failed"
                else if (Number(action.meta.requestId) === state.allMoreLatest) delete state.allMoreStatus
                return
            }
            if (Number(action.meta.requestId) === state.allLatest) state.allStatus = "failed"
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
        // The manager's shops are theirs alone: whoever signs in next loads their own.
        builder.addCase(logOut.fulfilled, (state) => {
            state.data = []
            delete state.dataStatus
        })
        // An answer becomes `selected` when it is about the shop last asked
        // for (a late one about a shop opened before would replace it and
        // leave its page waiting) and was asked for after the copy already
        // held, if that copy is of the same shop (so an older answer never
        // undoes a newer one, yet still stands in when a newer request fails).
        // Only the latest request's failure counts as the shop failing to load.
        builder.addCase(fetchSingleShop.pending, (state, action) => {
            state.selectedWanted = action.meta.arg
            state.selectedLatest = Number(action.meta.requestId)
            if (state.selectedFailed === action.meta.arg) delete state.selectedFailed
        })
        builder.addCase(fetchSingleShop.fulfilled, (state, action) => {
            if (action.meta.arg !== state.selectedWanted) return
            const request = Number(action.meta.requestId)
            if (state.selected?._id === action.meta.arg && request < (state.selectedFrom ?? 0)) return
            state.selected = action.payload
            state.selectedFrom = request
        })
        builder.addCase(fetchSingleShop.rejected, (state, action) => {
            if (Number(action.meta.requestId) !== state.selectedLatest) return
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
export const selectAllShopsQuery = (state: RootState) => state.shops.allQuery
export const selectAllShopsWanted = (state: RootState) => state.shops.allWanted
export const selectAllShopsNext = (state: RootState) => state.shops.allNext
export const selectAllShopsMoreStatus = (state: RootState) => state.shops.allMoreStatus
export const selectShopsDataStatus = (state: RootState) => state.shops.dataStatus
// A page's own shop: the one selected, but only once it is the one the page
// asked for (the store may still hold another shop), else null.
export const selectShopFor = (state: RootState, shopId: string | undefined) =>
    state.shops.selected?._id === shopId ? state.shops.selected : null
// Whether loading the page's own shop failed.
export const selectShopFailed = (state: RootState, shopId: string | undefined) =>
    state.shops.selectedFailed === shopId

export default shopsSlice.reducer