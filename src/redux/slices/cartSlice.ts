import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit"
import { ICart, ICartStore, IItem } from "../../typings/cart"
import backend from "../../backend/backend"
import axios, { AxiosResponse } from "axios"
import type { AppThunk, RootState } from "../app/store"
import { menuIdOf } from "../../lib/cart"

const initialState: ICartStore = {
    data: {
        _id: "",
        userId: "",
        tableId: "",
        status: "",
        items: [],
        split: [],
    },
    pointers: {
        shopId: "",
        tableId: "",
    }
   
}

interface AddToCartProps {
    shopId: string
    tableId: string
    item: IItem
}
interface AddToSplitProps {
    shopId: string
    tableId: string
    cartId: string
    item: IItem
}
const toCartPayload = (item: IItem) => ({
    menuId: typeof item.menuId === "string" ? item.menuId : item.menuId?._id,
    qty: item.qty,
})

export const addToCart = createAsyncThunk(
    "cart/addToCart",
    async ({shopId, tableId, item}: AddToCartProps, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/addItem`, toCartPayload(item))
            return data
        } catch (err) {
            // The menu card tells a sold-out 409 apart from any other failure.
            if (axios.isAxiosError(err)) {
                return rejectWithValue({
                    status: err.response?.status,
                    message: err.response?.data?.message,
                })
            }
            throw err
        }
    }
)
export const addToSplit = createAsyncThunk(
    "cart/addToSplit",
    async ({shopId, tableId, cartId, item}: AddToSplitProps, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/${cartId}/addSplitItem`, toCartPayload(item))
            return data
        } catch (err) {
            // A 409 means the units were claimed first (or it sold out).
            if (axios.isAxiosError(err)) {
                return rejectWithValue({
                    status: err.response?.status,
                    message: err.response?.data?.message,
                })
            }
            throw err
        }
    }
)
export const decreaseSplit = createAsyncThunk("cart/ decreaseSplit", async ({shopId, tableId, cartId, item}: AddToSplitProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/${cartId}/decreaseSplitItem`, toCartPayload(item))
    return data
})

export const removeFromCart = createAsyncThunk("cart/removeFromCart", async ({shopId, tableId, item}: AddToCartProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/removeItem`, toCartPayload(item))
    return data
})
export const deleteFromCart = createAsyncThunk("cart/deleteFromCart", async ({shopId, tableId, item}: AddToCartProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/deleteItem`, toCartPayload(item))
    return data
})

export const removeFromSplit = createAsyncThunk("cart/removeFromSplit", async ({shopId, tableId, cartId, item}: AddToSplitProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/${cartId}/removeSplitItem`, toCartPayload(item))
    return data
})

export const getTableCart = createAsyncThunk(
    "cart/getTableCart",
    async (tableId: string, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<ICart> = await backend.get(`carts/tables/${tableId}`)
            return data
        } catch (err) {
            // A 404 means the table has no open cart (none yet, or it was paid
            // off); the reducer tells that apart from a failed request.
            if (axios.isAxiosError(err)) {
                return rejectWithValue({ status: err.response?.status })
            }
            throw err
        }
    }
)
interface CheckOutProps {
    tableId: string
    cartId: string
}
export const createCheckoutOrder = createAsyncThunk(
    "cart/createCheckoutOrder",
    async ({tableId, cartId}: CheckOutProps, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<{ paypalOrderId: string }> = await backend.post(`carts/tables/${tableId}/${cartId}/createCheckoutOrder`)
            return data.paypalOrderId
        } catch (err) {
            if (axios.isAxiosError(err)) {
                return rejectWithValue({
                    status: err.response?.status,
                    message: err.response?.data?.message,
                })
            }
            throw err
        }
    }
)

interface CaptureCheckoutProps extends CheckOutProps {
    paypalOrderId: string
}
export const captureCheckout = createAsyncThunk(
    "cart/captureCheckout",
    async ({tableId, cartId, paypalOrderId}: CaptureCheckoutProps, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<ICart> = await backend.post(`carts/tables/${tableId}/${cartId}/captureCheckout`, { paypalOrderId })
            return data
        } catch (err) {
            if (axios.isAxiosError(err)) {
                return rejectWithValue({
                    status: err.response?.status,
                    message: err.response?.data?.message,
                })
            }
            throw err
        }
    }
)

// Back to no cart: also drops selections still on their way (their sync loops
// see nothing wanted and stop) and the notes about failed ones.
const clearCart = (state: ICartStore) => {
    state.data = initialState.data
    delete state.pending
    delete state.splitErrors
}

export const cartsSlice = createSlice({
    name: "carts",
    initialState,
    reducers: {
        storeCartPointers(state, action) {
            const { shopId, tableId } = action.payload
            state.pointers.shopId = shopId
            state.pointers.tableId = tableId
        },
        wantSplit(state, action: PayloadAction<{ menuId: string; qty: number }>) {
            const { menuId, qty } = action.payload
            state.pending = { ...state.pending, [menuId]: qty }
            if (state.splitErrors) delete state.splitErrors[menuId]
        },
        splitSettled(state, action: PayloadAction<string>) {
            if (state.pending) delete state.pending[action.payload]
        },
        splitFailed(state, action: PayloadAction<{ menuId: string; message: string }>) {
            const { menuId, message } = action.payload
            if (state.pending) delete state.pending[menuId]
            state.splitErrors = { ...state.splitErrors, [menuId]: message }
        },
    },
    extraReducers: (builder) => {
        builder.addCase(addToCart.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(addToSplit.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(removeFromCart.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(deleteFromCart.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(decreaseSplit.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(removeFromSplit.fulfilled, (state, action) => {
            state.data = action.payload
        })
        // The cart shown must be the one for the table asked about, as the BE
        // has it now. Moving to another table clears the old cart at once, so it
        // is never shown (or acted on) under the new one. Only the latest fetch
        // counts; an older answer arriving late is dropped. A 404 (no open cart:
        // none yet, or everything was paid) empties the cart; any other failure
        // keeps the last good one, as the cart is probably still there.
        builder.addCase(getTableCart.pending, (state, action) => {
            state.cartRequestId = action.meta.requestId
            if (state.data.tableId && state.data.tableId !== action.meta.arg) {
                clearCart(state)
            }
        })
        builder.addCase(getTableCart.fulfilled, (state, action) => {
            if (action.meta.requestId !== state.cartRequestId) return
            state.data = action.payload
        })
        builder.addCase(getTableCart.rejected, (state, action) => {
            if (action.meta.requestId !== state.cartRequestId) return
            if ((action.payload as { status?: number } | undefined)?.status === 404) {
                clearCart(state)
            }
        })
        builder.addCase(captureCheckout.fulfilled, (state, action) => {
            state.data = action.payload
        })
    }
})

export const { storeCartPointers } = cartsSlice.actions
const { wantSplit, splitSettled, splitFailed } = cartsSlice.actions
export const selectCartsData = (state: RootState) => state.carts.data
export const selectCartPointers = (state: RootState) => state.carts.pointers

const NO_PENDING: Record<string, number> = {}
const NO_ERRORS: Record<string, string> = {}
export const selectPendingSplit = (state: RootState) => state.carts.pending ?? NO_PENDING
export const selectSplitErrors = (state: RootState) => state.carts.splitErrors ?? NO_ERRORS

// ---- Optimistic split quantities ---------------------------------------------
// A tap on −/+ (or a checkbox, or Select All) sets how many units of an item I
// want in my open split, and the cart shows that at once. A loop per item then
// brings the BE round to it, one request at a time: it reads the wanted count
// afresh after every answer, so taps made meanwhile are folded in and a burst
// of + becomes one addSplitItem for the difference. Nothing is ever sent past
// what the row allowed, and a request never races another for the same item.
// On failure the wanted count is dropped, the cart refetched, and the row says
// why; the display falls back to what the BE holds.

interface SplitTarget {
    shopId: string
    tableId: string
    cartId: string
    menuId: string
}

// Items with a loop running. Module-level because a loop outlives the row that
// started it (it finishes even if the diner leaves the cart page).
const syncing = new Set<string>()

const myHeldQty = (state: RootState, menuId: string) =>
    state.carts.data.split.find(
        (s) =>
            s.splitStatus === "open" &&
            s.userId === state.user.data._id &&
            menuIdOf(s) === menuId
    )?.qty ?? 0

const syncSplit = ({ shopId, tableId, cartId, menuId }: SplitTarget): AppThunk<Promise<void>> =>
    async (dispatch, getState) => {
        if (syncing.has(menuId)) return
        syncing.add(menuId)
        let adding = false
        try {
            for (;;) {
                const state = getState()
                const wanted = state.carts.pending?.[menuId]
                if (wanted === undefined) return
                const held = myHeldQty(state, menuId)
                const item = state.carts.data.items.find((i) => menuIdOf(i) === menuId)
                if (!item || wanted === held) {
                    dispatch(splitSettled(menuId))
                    return
                }
                const target = { shopId, tableId, cartId, item }
                adding = wanted > held
                if (adding) {
                    await dispatch(addToSplit({ ...target, item: { ...item, qty: wanted - held } })).unwrap()
                } else if (wanted === 0) {
                    await dispatch(removeFromSplit(target)).unwrap()
                } else {
                    // The BE only takes one unit off per call.
                    await dispatch(decreaseSplit(target)).unwrap()
                }
                // A request that "worked" but moved nothing would loop forever.
                if (myHeldQty(getState(), menuId) === held) throw new Error("split unchanged")
            }
        } catch (err) {
            const status = (err as { status?: number } | undefined)?.status
            dispatch(splitFailed({
                menuId,
                message: adding && status === 409
                    ? "Not enough left, someone else just took it."
                    : "Couldn't update that, please try again.",
            }))
            await dispatch(getTableCart(tableId))
        } finally {
            syncing.delete(menuId)
        }
    }

export const setSplitQty = (target: SplitTarget & { qty: number }): AppThunk =>
    (dispatch) => {
        const { qty, ...rest } = target
        dispatch(wantSplit({ menuId: rest.menuId, qty }))
        void dispatch(syncSplit(rest))
    }

export default cartsSlice.reducer