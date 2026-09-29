import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit"
import { ICart, ICartNotice, ICartStore, IItem } from "../../typings/cart"
import backend from "../../backend/backend"
import axios, { AxiosResponse } from "axios"
import type { AppThunk, RootState } from "../app/store"
import { menuIdOf, myOpenSplit } from "../../lib/cart"

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
const toCartPayload = (item: IItem) => ({ menuId: menuIdOf(item), qty: item.qty })

// A refused cart request: the BE's status and reason (e.g. 409 "Someone at the
// table is paying for those"), for the UI to tell refusals apart.
export type CartRejection = { status?: number; message?: string }

const reasonOf = (err: unknown): CartRejection => {
    if (axios.isAxiosError(err)) return { status: err.response?.status, message: err.response?.data?.message }
    throw err
}

export const addToCart = createAsyncThunk(
    "cart/addToCart",
    async ({shopId, tableId, item}: AddToCartProps, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/addItem`, toCartPayload(item))
            return data
        } catch (err) {
            // The menu card tells a sold-out 409 apart from any other failure.
            return rejectWithValue(reasonOf(err))
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
            return rejectWithValue(reasonOf(err))
        }
    }
)
export const decreaseSplit = createAsyncThunk("cart/ decreaseSplit", async ({shopId, tableId, cartId, item}: AddToSplitProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/${cartId}/decreaseSplitItem`, toCartPayload(item))
    return data
})

// Orders `item.qty` fewer of an item for the table. Answers 204 when that
// empties the cart, which the BE then deletes.
export const removeFromCart = createAsyncThunk(
    "cart/removeFromCart",
    async ({shopId, tableId, item}: AddToCartProps, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<ICart | ""> = await backend.post(`carts/${shopId}/tables/${tableId}/removeItem`, toCartPayload(item))
            return data
        } catch (err) {
            return rejectWithValue(reasonOf(err))
        }
    }
)
// Removes the item's unpaid units that no one else is paying for. Answers 204
// when that empties the cart, which the BE then deletes.
export const deleteFromCart = createAsyncThunk(
    "cart/deleteFromCart",
    async ({shopId, tableId, item}: AddToCartProps, { rejectWithValue }) => {
        try {
            const { data }: AxiosResponse<ICart | ""> = await backend.post(`carts/${shopId}/tables/${tableId}/deleteItem`, toCartPayload(item))
            return data
        } catch (err) {
            return rejectWithValue(reasonOf(err))
        }
    }
)

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
            // Its body may carry notices from a cart closed lately that this
            // diner took part in ("The staff closed this table").
            if (axios.isAxiosError(err)) {
                const notices = (err.response?.data as { notices?: ICartNotice[] } | undefined)?.notices
                return rejectWithValue({ status: err.response?.status, notices })
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
            return rejectWithValue(reasonOf(err))
        }
    }
)

interface CaptureCheckoutProps extends CheckOutProps {
    paypalOrderId: string
}
// `pending`: the BE answered 202, PayPal took the money but is still reviewing
// it. The diner's items are held for them until staff confirm it.
export const captureCheckout = createAsyncThunk(
    "cart/captureCheckout",
    async ({tableId, cartId, paypalOrderId}: CaptureCheckoutProps, { rejectWithValue }) => {
        try {
            const { data, status }: AxiosResponse<ICart> = await backend.post(`carts/tables/${tableId}/${cartId}/captureCheckout`, { paypalOrderId })
            return { cart: data, pending: status === 202 }
        } catch (err) {
            return rejectWithValue(reasonOf(err))
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
        // A 204 (no body): the BE deleted the emptied cart.
        const cartOrGone = (state: ICartStore, action: PayloadAction<ICart | "">) => {
            if (action.payload) state.data = action.payload
            else clearCart(state)
        }
        builder.addCase(removeFromCart.fulfilled, cartOrGone)
        builder.addCase(deleteFromCart.fulfilled, cartOrGone)
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
            const rejection = action.payload as { status?: number; notices?: ICartNotice[] } | undefined
            if (rejection?.status === 404) {
                clearCart(state)
                // Shown on the empty cart page, so its diners learn why.
                // (A new object: the cleared cart is the frozen initial one.) It
                // keeps the table they're about, so moving to another table
                // clears them (see pending) even if that table's fetch fails.
                if (rejection.notices?.length) {
                    state.data = { ...state.data, tableId: action.meta.arg, notices: rejection.notices }
                }
            }
        })
        builder.addCase(captureCheckout.fulfilled, (state, action) => {
            state.data = action.payload.cart
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
    myOpenSplit(state.carts.data.split, state.user.data._id, menuId)?.qty ?? 0

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
            const { status, message } = (err as CartRejection | undefined) ?? {}
            dispatch(splitFailed({
                menuId,
                message: adding && status === 409
                    ? message === "This item is sold out"
                        ? "Sorry, that just sold out."
                        : "Not enough left, someone else just took it."
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