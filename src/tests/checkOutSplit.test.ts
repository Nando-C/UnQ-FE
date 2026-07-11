import { describe, it, expect } from "vitest"
import { http, HttpResponse } from "msw"
import { checkOutSplit } from "../redux/slices/cartSlice"
import { makeStore } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"

const closedCart: ICart = {
  _id: "cart1",
  userId: "u1",
  tableId: "t1",
  status: "closed",
  items: [],
  split: [],
}

describe("checkOutSplit thunk", () => {
  it("updates store.carts.data on a 200", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/checkOutSplit`, () =>
        HttpResponse.json(closedCart)
      )
    )

    const store = makeStore()
    await store.dispatch(
      checkOutSplit({ tableId: "t1", cartId: "cart1", paypalOrderId: "order1" })
    )

    expect(store.getState().carts.data).toEqual(closedCart)
  })

  it("rejects .unwrap() on a 402 replay/verification failure", async () => {
    server.use(
      http.post(
        `${BASE}/carts/tables/t1/cart1/checkOutSplit`,
        () => HttpResponse.json({ message: "Order already used" }, { status: 402 })
      )
    )

    const store = makeStore()
    await expect(
      store
        .dispatch(
          checkOutSplit({ tableId: "t1", cartId: "cart1", paypalOrderId: "order1" })
        )
        .unwrap()
    ).rejects.toBeTruthy()
  })

  it("rejection carries {status, message} from the BE's 409 conflict body", async () => {
    server.use(
      http.post(
        `${BASE}/carts/tables/t1/cart1/checkOutSplit`,
        () =>
          HttpResponse.json(
            { message: "Not enough units left to split" },
            { status: 409 }
          )
      )
    )

    const store = makeStore()
    const result = await store.dispatch(
      checkOutSplit({ tableId: "t1", cartId: "cart1", paypalOrderId: "order1" })
    )

    expect(result.type).toBe("cart/checkOutSplit/rejected")
    expect(result.payload).toEqual({
      status: 409,
      message: "Not enough units left to split",
    })
  })
})
