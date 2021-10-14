import { createAsyncThunk, createSlice } from "@reduxjs/toolkit"
import { ICart, ICartStore, IItem } from "../../typings/cart"
import backend from "../../backend/backend"
import { AxiosResponse } from "axios"
import { RootState } from "../app/store"

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
export const getMyOpenCart = createAsyncThunk("cart/getMyOpenCart", async () => {
    const { data }: AxiosResponse<ICart> = await backend.get(`carts/`)
    return data
})
export const addToCart = createAsyncThunk("cart/addToCart", async ({shopId, tableId, item}: AddToCartProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/addItem`, item)
    return data
})
export const addToSplit = createAsyncThunk("cart/addToSplit", async ({shopId, tableId, cartId, item}: AddToSplitProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/${cartId}/addSplitItem`, item)
    return data
})
export const decreaseSplit = createAsyncThunk("cart/ decreaseSplit", async ({shopId, tableId, cartId, item}: AddToSplitProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/${cartId}/decreaseSplitItem`, item)
    return data
})

export const removeFromCart = createAsyncThunk("cart/removeFromCart", async ({shopId, tableId, item}: AddToCartProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/removeItem`, item)
    return data
})
export const deleteFromCart = createAsyncThunk("cart/deleteFromCart", async ({shopId, tableId, item}: AddToCartProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/deleteItem`, item)
    return data
})

export const removeFromSplit = createAsyncThunk("cart/removeFromSplit", async ({shopId, tableId, cartId, item}: AddToSplitProps) => {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/${shopId}/tables/${tableId}/${cartId}/removeSplitItem`, item)
    return data
})

export const getTableCart = createAsyncThunk("cart/getTableCart", async (tableId: string)=> {
    const { data }: AxiosResponse<ICart> = await backend.get(`carts/tables/${tableId}`)
    return data
})
export const checkOutItem = createAsyncThunk("cart/checkOutItem", async ({shopId, tableId, cartId, item}: AddToSplitProps)=> {
    const { data }: AxiosResponse<ICart> = await backend.post(`carts/tables/${tableId}/${cartId}/checkOutSplitItem`, item)
    return data
})

export const cartsSlice = createSlice({
    name: "carts",
    initialState,
    reducers: {
        storeCartPointers(state, action) {
            const { shopId, tableId } = action.payload
            state.pointers.shopId = shopId
            state.pointers.tableId = tableId
        }
    },
    extraReducers: (builder) => {
        builder.addCase(getMyOpenCart.fulfilled, (state, action) => {
            state.data = action.payload
        })
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
        builder.addCase(getTableCart.fulfilled, (state, action) => {
            state.data = action.payload
        })
        builder.addCase(checkOutItem.fulfilled, (state, action) => {
            state.data = action.payload
        })
    }
})

export const { storeCartPointers } = cartsSlice.actions
export const selectCartsData = (state: RootState) => state.carts.data
export const selectCartPointers = (state: RootState) => state.carts.pointers
// export const selectCartItem = (id: string | undefined, state: RootState) => state.carts.data.items.find(item => item._id === id)

export default cartsSlice.reducer