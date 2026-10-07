import { describe, it, expect } from "vitest"
import { http, HttpResponse } from "msw"
import { captureCheckout, captureStripeCheckout, createCheckoutOrder, createStripeCheckout, getTableCart } from "../redux/slices/cartSlice"
import { paidOutcome } from "../lib/paymentOutcome"
import { gate, type AppStore } from "./helpers"
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

  it("resolves to the cart, and whether PayPal is still reviewing the payment (202)", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () =>
        HttpResponse.json(closedCart, { status: 202 })
      )
    )

    const store = makeStore()
    const result = await store
      .dispatch(captureCheckout({ tableId: "t1", cartId: "cart1", paypalOrderId: "order1" }))
      .unwrap()

    expect(result).toEqual({ cart: closedCart, pending: true })
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

describe("card checkout thunks", () => {
  it("createStripeCheckout resolves to the client secret and payment id", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/createStripeCheckout`, () =>
        HttpResponse.json({ clientSecret: "pi_1_secret_x", paymentIntentId: "pi_1" })
      )
    )

    const result = await makeStore().dispatch(createStripeCheckout({ tableId: "t1", cartId: "cart1" })).unwrap()

    expect(result).toEqual({ clientSecret: "pi_1_secret_x", paymentIntentId: "pi_1" })
  })

  it("captureStripeCheckout passes the BE's reason through with its status and message", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureStripeCheckout`, () =>
        HttpResponse.json({ message: "We're still confirming your payment", reason: "STILL_CONFIRMING" }, { status: 502 })
      )
    )

    const result = await makeStore().dispatch(
      captureStripeCheckout({ tableId: "t1", cartId: "cart1", paymentIntentId: "pi_1" })
    )

    expect(result.payload).toEqual({ status: 502, message: "We're still confirming your payment", reason: "STILL_CONFIRMING" })
  })

  it("captureStripeCheckout puts the cart on its own table's page only", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureStripeCheckout`, () => HttpResponse.json(closedCart, { status: 202 }))
    )
    const here = makeStore({ carts: { data: { ...closedCart, status: "open" }, pointers: { shopId: "s1", tableId: "t1" } } })
    const elsewhere = makeStore({ carts: { data: { ...closedCart, _id: "cart2", tableId: "t2" }, pointers: { shopId: "s1", tableId: "t2" } } })
    const args = { tableId: "t1", cartId: "cart1", paymentIntentId: "pi_1" }

    expect(await here.dispatch(captureStripeCheckout(args)).unwrap()).toEqual({ cart: closedCart, pending: true })
    await elsewhere.dispatch(captureStripeCheckout(args))

    expect(here.getState().carts.data).toEqual(closedCart)
    expect(elsewhere.getState().carts.data._id).toBe("cart2")
  })
})

describe("after a capture", () => {
  it.each([
    ["PayPal", (store: AppStore) => store.dispatch(captureCheckout({ tableId: "t1", cartId: "cart1", paypalOrderId: "order1" })), "captureCheckout"],
    ["a card", (store: AppStore) => store.dispatch(captureStripeCheckout({ tableId: "t1", cartId: "cart1", paymentIntentId: "pi_1" })), "captureStripeCheckout"],
  ] as const)("drops a table fetch sent before %s's capture answered", async (_, capture, route) => {
    const held = gate()
    const unpaid = { ...closedCart, status: "open" }
    server.use(
      http.get(`${BASE}/carts/tables/t1`, async () => {
        await held.opened
        return HttpResponse.json(unpaid)
      }),
      http.post(`${BASE}/carts/tables/t1/cart1/${route}`, () => HttpResponse.json(closedCart))
    )
    const store = makeStore({ carts: { data: unpaid, pointers: { shopId: "s1", tableId: "t1" } } })
    const fetching = store.dispatch(getTableCart("t1"))

    await capture(store)
    held.open()
    await fetching

    expect(store.getState().carts.data).toEqual(closedCart)
  })
})

describe("payment outcomes", () => {
  it("looks again later only at a card payment still processing, not one PayPal reviews", () => {
    expect(paidOutcome("stripe", true).recheck).toBe(true)
    expect(paidOutcome("paypal", true).recheck).toBe(false)
  })
})
