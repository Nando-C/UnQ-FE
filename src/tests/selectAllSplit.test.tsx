import { describe, it, expect, beforeEach } from "vitest"
import { fireEvent, screen, waitFor } from "@testing-library/react"
import { delay, http, HttpResponse } from "msw"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"

const menu = (id: string, price: number): IMenu => ({
  _id: id,
  name: `item-${id}`,
  image: "",
  short_description: "",
  description: "",
  price,
  available: true,
  category: "food",
})

const me = {
  _id: "u1",
  name: "Split",
  surname: "Tester",
  email: "u1@test.io",
  avatar: "",
  role: "customer",
}

const baseCart = (): ICart => ({
  _id: "cart1",
  userId: "u1",
  tableId: "t1",
  status: "open",
  items: [
    { _id: "i1", menuId: menu("m1", 4.5), qty: 2, qtyPayed: 0 },
    { _id: "i2", menuId: menu("m2", 3), qty: 1, qtyPayed: 0 },
  ],
  split: [],
})

// A tiny stateful mock BE: split adds/removes mutate `cartState` and every
// response returns the whole updated cart, exactly like the real API.
let cartState: ICart
const added: { menuId: string; qty: number }[] = []
const removed: string[] = []

const mySplit = (menuId: string) =>
  cartState.split.find(
    (s) =>
      s.splitStatus === "open" &&
      s.userId === "u1" &&
      (typeof s.menuId === "string" ? s.menuId : s.menuId?._id) === menuId
  )

// Milliseconds the mock waits before answering a split change: long enough for
// several clicks to land while a request is still out.
let latency = 0
// When set, addSplitItem answers 409 as the BE does when the units are gone.
let rejectAdds = false

const installHandlers = () => {
  server.use(
    http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cartState)),
    http.post(
      `${BASE}/carts/:shopId/tables/:tableId/:cartId/addSplitItem`,
      async ({ request }) => {
        const { menuId, qty } = (await request.json()) as {
          menuId: string
          qty: number
        }
        added.push({ menuId, qty })
        await delay(latency)
        if (rejectAdds) {
          return HttpResponse.json({ message: "Not enough units left to split" }, { status: 409 })
        }
        const existing = mySplit(menuId)
        if (existing) {
          existing.qty += qty
        } else {
          const item = cartState.items.find(
            (i) => (typeof i.menuId === "string" ? i.menuId : i.menuId?._id) === menuId
          )
          cartState.split.push({
            _id: `s-${menuId}`,
            userId: "u1",
            menuId: item!.menuId,
            qty,
            splitStatus: "open",
          })
        }
        return HttpResponse.json(cartState)
      }
    ),
    http.post(
      `${BASE}/carts/:shopId/tables/:tableId/:cartId/removeSplitItem`,
      async ({ request }) => {
        const { menuId } = (await request.json()) as { menuId: string }
        removed.push(menuId)
        cartState.split = cartState.split.filter((s) => s !== mySplit(menuId))
        return HttpResponse.json(cartState)
      }
    )
  )
}

const renderCart = () =>
  renderWithProviders(<CartListItems />, {
    preloadedState: {
      user: { data: me, status: "authenticated" },
      // A copy: the store freezes what it's given, and the mock BE keeps
      // mutating cartState.
      carts: { data: structuredClone(cartState), pointers: { shopId: "s1", tableId: "t1" } },
    },
    route: "/shops/s1/tables/t1/cart",
    path: "/shops/:shopId/tables/:tableId/cart",
  })

// Checkbox order in the DOM: [Select All, item i1, item i2].
const boxes = () => screen.getAllByRole("checkbox")

describe("Select All / individual split selection", () => {
  beforeEach(() => {
    cartState = baseCart()
    added.length = 0
    removed.length = 0
    latency = 0
    rejectAdds = false
    installHandlers()
  })

  it("Select All adds every unselected item with its full remaining qty", async () => {
    const { user } = renderCart()

    const [selectAll] = boxes()
    expect(selectAll).not.toBeChecked()

    await user.click(selectAll)

    await waitFor(() =>
      expect(added).toEqual([
        { menuId: "m1", qty: 2 },
        { menuId: "m2", qty: 1 },
      ])
    )
    await waitFor(() => expect(boxes()[0]).toBeChecked())
    expect(boxes()[1]).toBeChecked()
    expect(boxes()[2]).toBeChecked()
  })

  it("unchecking one item removes only that item and just unticks Select All", async () => {
    cartState.split = [
      { _id: "s-m1", userId: "u1", menuId: menu("m1", 4.5), qty: 2, splitStatus: "open" },
      { _id: "s-m2", userId: "u1", menuId: menu("m2", 3), qty: 1, splitStatus: "open" },
    ]
    const { user } = renderCart()

    await waitFor(() => expect(boxes()[0]).toBeChecked())

    await user.click(boxes()[1]) // uncheck item m1

    await waitFor(() => expect(removed).toEqual(["m1"]))
    await waitFor(() => expect(boxes()[1]).not.toBeChecked())
    // The other item's selection survives; only the header untick follows.
    expect(boxes()[2]).toBeChecked()
    expect(boxes()[0]).not.toBeChecked()
    expect(added).toEqual([]) // and nothing got (re)added anywhere
  })

  it("hand-selecting the last remaining item ticks Select All", async () => {
    cartState.split = [
      { _id: "s-m1", userId: "u1", menuId: menu("m1", 4.5), qty: 1, splitStatus: "open" },
    ]
    const { user } = renderCart()

    expect(boxes()[0]).not.toBeChecked()

    await user.click(boxes()[2]) // select item m2 individually

    await waitFor(() => expect(added).toEqual([{ menuId: "m2", qty: 1 }]))
    await waitFor(() => expect(boxes()[0]).toBeChecked())
  })

  it("unchecking Select All clears every selection", async () => {
    cartState.split = [
      { _id: "s-m1", userId: "u1", menuId: menu("m1", 4.5), qty: 2, splitStatus: "open" },
      { _id: "s-m2", userId: "u1", menuId: menu("m2", 3), qty: 1, splitStatus: "open" },
    ]
    const { user } = renderCart()

    await waitFor(() => expect(boxes()[0]).toBeChecked())

    await user.click(boxes()[0])

    await waitFor(() => expect(removed).toEqual(["m1", "m2"]))
    await waitFor(() => expect(boxes()[0]).not.toBeChecked())
    expect(boxes()[1]).not.toBeChecked()
    expect(boxes()[2]).not.toBeChecked()
  })
})

describe("cross-user split availability", () => {
  beforeEach(() => {
    cartState = baseCart()
    added.length = 0
    removed.length = 0
    latency = 0
    rejectAdds = false
    installHandlers()
  })

  it("disables the checkbox and shows a claimed hint when another user holds every remaining unit", async () => {
    cartState.split = [
      { _id: "s-m2-other", userId: "u2", menuId: menu("m2", 3), qty: 1, splitStatus: "open" },
    ]
    renderCart()

    await waitFor(() => expect(boxes()[2]).toBeDisabled())
    expect(screen.getByText(/claimed by others/i)).toBeInTheDocument()
    // The other item (not contested) stays enabled.
    expect(boxes()[1]).not.toBeDisabled()
  })

  it("Select All skips a fully-claimed item but still ticks once the rest are selected", async () => {
    cartState.split = [
      { _id: "s-m2-other", userId: "u2", menuId: menu("m2", 3), qty: 1, splitStatus: "open" },
    ]
    const { user } = renderCart()

    const [selectAll] = boxes()
    await user.click(selectAll)

    // Only the uncontested item (m1) gets added; m2 is fully claimed by u2.
    await waitFor(() => expect(added).toEqual([{ menuId: "m1", qty: 2 }]))
    await waitFor(() => expect(boxes()[0]).toBeChecked())
    expect(boxes()[2]).toBeDisabled()
  })

  it("re-fetches the cart when addSplitItem is rejected with a 409 (someone else claimed it first)", async () => {
    let getCalls = 0
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => {
        getCalls++
        return HttpResponse.json(cartState)
      }),
      http.post(
        `${BASE}/carts/:shopId/tables/:tableId/:cartId/addSplitItem`,
        () =>
          HttpResponse.json(
            { message: "Not enough units left to split" },
            { status: 409 }
          )
      )
    )
    const { user } = renderCart()

    await waitFor(() => expect(getCalls).toBe(1))

    await user.click(boxes()[1])

    await waitFor(() => expect(getCalls).toBe(2))
  })
})

describe("clicking faster than the BE answers", () => {
  beforeEach(() => {
    cartState = baseCart()
    added.length = 0
    removed.length = 0
    latency = 150
    rejectAdds = false
    installHandlers()
  })

  const qtyShown = () => document.querySelector(".stepper .qty")?.textContent
  const checkout = () => screen.getByRole("button", { name: /CheckOut/ })

  it("shows a tap at once, holds checkout until the BE agrees, and caps + at what's in the cart", async () => {
    // m1 has 2 in the cart and I hold 1, so exactly one more can be claimed.
    cartState.split = [
      { _id: "s-m1", userId: "u1", menuId: menu("m1", 4.5), qty: 1, splitStatus: "open" },
    ]
    renderCart()

    const plus = screen.getAllByRole("button", { name: "Increase quantity" })[0]
    fireEvent.click(plus)
    fireEvent.click(plus)
    fireEvent.click(plus)

    // Before any answer: the count moved, + is spent, checkout waits.
    expect(qtyShown()).toBe("2")
    expect(plus).toBeDisabled()
    expect(checkout()).toBeDisabled()

    await waitFor(() => expect(checkout()).toBeEnabled())
    expect(mySplit("m1")?.qty).toBe(2)
    expect(added).toEqual([{ menuId: "m1", qty: 1 }])
  })

  it("folds a burst of taps into as few requests as the answers allow", async () => {
    cartState.items[0].qty = 5
    cartState.split = [
      { _id: "s-m1", userId: "u1", menuId: menu("m1", 4.5), qty: 1, splitStatus: "open" },
    ]
    renderCart()

    const plus = screen.getAllByRole("button", { name: "Increase quantity" })[0]
    fireEvent.click(plus)
    fireEvent.click(plus)
    fireEvent.click(plus)
    expect(qtyShown()).toBe("4")

    await waitFor(() => expect(checkout()).toBeEnabled())
    expect(mySplit("m1")?.qty).toBe(4)
    // The first tap went out alone; the two made while it was out, together.
    expect(added).toEqual([
      { menuId: "m1", qty: 1 },
      { menuId: "m1", qty: 2 },
    ])
  })

  it("snaps back to what the BE holds and says why when the units are gone", async () => {
    cartState.split = [
      { _id: "s-m1", userId: "u1", menuId: menu("m1", 4.5), qty: 1, splitStatus: "open" },
    ]
    rejectAdds = true
    renderCart()

    fireEvent.click(screen.getAllByRole("button", { name: "Increase quantity" })[0])
    expect(qtyShown()).toBe("2")

    await waitFor(() => expect(qtyShown()).toBe("1"))
    expect(screen.getByText("Not enough left, someone else just took it.")).toBeInTheDocument()
    expect(checkout()).toBeEnabled()
  })

  it("a second Select All click before the first lands undoes it instead of claiming twice", async () => {
    renderCart()

    const [selectAll] = boxes()
    fireEvent.click(selectAll)
    expect(boxes()[0]).toBeChecked()
    fireEvent.click(selectAll)
    expect(boxes()[0]).not.toBeChecked()

    await waitFor(() => expect(checkout()).toBeEnabled())
    // Each item claimed once, then released: nothing held, nothing doubled.
    expect(added).toEqual([
      { menuId: "m1", qty: 2 },
      { menuId: "m2", qty: 1 },
    ])
    expect(removed.sort()).toEqual(["m1", "m2"])
    expect(cartState.split).toEqual([])
    expect(boxes()[0]).not.toBeChecked()
  })
})
