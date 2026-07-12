import { describe, it, expect } from "vitest"
import { http, HttpResponse } from "msw"
import { captureCheckout, createCheckoutOrder } from "../redux/slices/cartSlice"
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

describe("createCheckoutOrder thunk", () => {
  it("resolves to the paypalOrderId from a 200", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/createCheckoutOrder`, () =>
        HttpResponse.json({ paypalOrderId: "order1" })
      )
    )

    const store = makeStore()
    const result = await store
      .dispatch(createCheckoutOrder({ tableId: "t1", cartId: "cart1" }))
      .unwrap()

    expect(result).toBe("order1")
  })

  it("rejects with {status, message} on a 409 availability conflict", async () => {
    server.use(
      http.post(
        `${BASE}/carts/tables/t1/cart1/createCheckoutOrder`,
        () =>
          HttpResponse.json(
            { message: "Not enough units left to split" },
            { status: 409 }
          )
      )
    )

    const store = makeStore()
    const result = await store.dispatch(
      createCheckoutOrder({ tableId: "t1", cartId: "cart1" })
    )

    expect(result.type).toBe("cart/createCheckoutOrder/rejected")
    expect(result.payload).toEqual({
      status: 409,
      message: "Not enough units left to split",
    })
  })
})

describe("captureCheckout thunk", () => {
  it("updates store.carts.data on a 200", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () =>
        HttpResponse.json(closedCart)
      )
    )

    const store = makeStore()
    await store.dispatch(
      captureCheckout({ tableId: "t1", cartId: "cart1", paypalOrderId: "order1" })
    )

    expect(store.getState().carts.data).toEqual(closedCart)
  })

  it("rejects with {status, message} on a 402 replay/verification failure", async () => {
    server.use(
      http.post(
        `${BASE}/carts/tables/t1/cart1/captureCheckout`,
        () => HttpResponse.json({ message: "Order already used" }, { status: 402 })
      )
    )

    const store = makeStore()
    const result = await store.dispatch(
      captureCheckout({ tableId: "t1", cartId: "cart1", paypalOrderId: "order1" })
    )

    expect(result.type).toBe("cart/captureCheckout/rejected")
    expect(result.payload).toEqual({
      status: 402,
      message: "Order already used",
    })
  })

  it("rejects with {status, message} on a post-capture 409 (auto-refunded conflict)", async () => {
    server.use(
      http.post(
        `${BASE}/carts/tables/t1/cart1/captureCheckout`,
        () =>
          HttpResponse.json(
            { message: "Not enough units left to split" },
            { status: 409 }
          )
      )
    )

    const store = makeStore()
    const result = await store.dispatch(
      captureCheckout({ tableId: "t1", cartId: "cart1", paypalOrderId: "order1" })
    )

    expect(result.type).toBe("cart/captureCheckout/rejected")
    expect(result.payload).toEqual({
      status: 409,
      message: "Not enough units left to split",
    })
  })
})
