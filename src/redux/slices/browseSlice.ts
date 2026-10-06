import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { AxiosResponse } from "axios"
import backend from "../../backend/backend"
import { IBrowseStore, IShopPage } from "../../typings/shop"
import { RootState } from "../app/store"

const initialState: IBrowseStore = {
    shops: [],
    query: "",
    wanted: "",
    next: null,
}

export const SHOPS_PER_PAGE = 20
// How long the home page's shops are kept before arriving there loads them again.
export const SHOPS_FRESH_MS = 60_000

type BrowseArg = { q: string; cursor?: string }

// The home page's shops, a page at a time: the first page of the search `q`
// ("" for every shop), or with `cursor` the page after it. Each request's id
// (its number, as text) tells the latest from older ones, compared only for
// equality; each is timed. A first page on its way, or held
// and asked for less than SHOPS_FRESH_MS ago, is not asked again (Try again,
// after a failure, is); a next page is asked one at a time, and only of the
// search last asked for.
let browseRequests = 0
export const browseShops = createAsyncThunk<
    IShopPage,
    BrowseArg,
    { state: RootState; pendingMeta: { at: number } }
>(
    "browse/browseShops",
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
            const { browse } = getState()
            if (cursor) return browse.moreStatus !== "loading" && q === browse.wanted
            if (browse.wanted !== q) return true
            const fresh = Date.now() - (browse.askedAt ?? 0) < SHOPS_FRESH_MS
            return !(browse.status === "loading" || (browse.status === "ready" && fresh))
        },
    }
)

// Whether a next page continues the list held: same search, from its last shop.
const continues = (state: IBrowseStore, { q, cursor }: BrowseArg) => q === state.query && cursor === state.next
// A next page that doesn't still ends the wait for one if it's the latest asked
// (so "Show more" isn't left disabled).
const endWait = (state: IBrowseStore, requestId: string) => {
    if (requestId === state.moreLatest) delete state.moreStatus
}

export const browseSlice = createSlice({
    name: "browse",
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        // A first page counts only if it answers the search last asked for (an
        // older one, answered late, is ignored); it replaces the list. A next
        // page counts only if it continues the list held, and is added to it.
        // A first page of the same search doesn't end a next page's wait.
        builder.addCase(browseShops.pending, (state, action) => {
            if (action.meta.arg.cursor) {
                state.moreStatus = "loading"
                state.moreLatest = action.meta.requestId
                return
            }
            state.wanted = action.meta.arg.q
            state.latest = action.meta.requestId
            state.askedAt = action.meta.at
            state.status = "loading"
        })
        builder.addCase(browseShops.fulfilled, (state, action) => {
            const { arg, requestId } = action.meta
            if (arg.cursor) {
                if (!continues(state, arg)) return endWait(state, requestId)
                state.shops.push(...action.payload.shops)
                state.next = action.payload.next
                state.moreStatus = "ready"
                return
            }
            if (requestId !== state.latest) return
            // A next page still on its way is of another search's list, or of
            // this one (then it's added if it continues the new first page).
            if (!(arg.q === state.query && state.moreStatus === "loading")) delete state.moreStatus
            state.shops = action.payload.shops
            state.query = arg.q
            state.next = action.payload.next
            state.status = "ready"
        })
        builder.addCase(browseShops.rejected, (state, action) => {
            const { arg, requestId } = action.meta
            if (arg.cursor) {
                if (continues(state, arg)) state.moreStatus = "failed"
                else endWait(state, requestId)
                return
            }
            if (requestId === state.latest) state.status = "failed"
        })
    },
})

export const selectBrowse = (state: RootState) => state.browse

export default browseSlice.reducer
