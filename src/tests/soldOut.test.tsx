import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import MenuItem from "../components/Customers/MenuItem/MenuItem"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import CheckOut from "../components/Customers/CheckOut/CheckOut"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"
import type { IShop } from "../typings/shop"

// PayPal's SDK can't load in jsdom. Stand its button in with one that fires
// onApprove the way the SDK does once a buyer approves in the popup.
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ children }: { children: React.ReactNode }) => children,
  PayPalButtons: ({
    onApprove,
  }: {
    onApprove: (data: { orderID: string }) => Promise<void>
  }) => (
    <button onClick={() => onApprove({ orderID: "order1" })}>Approve</button>
  ),
}))

const menu = (id: string, price: number, available = true): IMenu => ({
  _id: id,
  name: `item-${id}`,
  image: "",
  short_description: "",
  description: "",
  price,
  available,
  category: "food",
})

const me = {
  _id: "u1",
  name: "Sold",
  surname: "Out",
  email: "u1@test.io",
  avatar: "",
  role: "customer",
}

describe("menu card", () => {
  const shopWith = (item: IMenu): IShop =>
    ({ _id: "s1", name: "Shop", menu: [item], tables: [] }) as unknown as IShop

  const renderCard = (shop: IShop) =>
    renderWithProviders(<MenuItem shopId="s1" itemId="m1" />, {
      preloadedState: {
        user: { data: me, status: "authenticated" },
        shops: { data: [], selected: shop, selectedMenu: null },
      },
      route: "/shops/s1/tables/t1",
      path: "/shops/:shopId/tables/:tableId",
    })

  it("shows a sold-out item greyed with a badge and no Add or quantity controls", () => {
    renderCard(shopWith(menu("m1", 5, false)))

    expect(screen.getByText("Sold out")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Increase quantity" })).not.toBeInTheDocument()
    expect(screen.getByText("item-m1").closest(".MenuItem")).toHaveAttribute(
      "aria-disabled",
      "true"
    )
  })

  it("explains a 409 on Add and refetches the shop so the card flips to sold out", async () => {
    let shopFetches = 0
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/addItem`, () =>
        HttpResponse.json({ message: "This item is sold out" }, { status: 409 })
      ),
      http.get(`${BASE}/shops/s1`, () => {
        shopFetches++
        return HttpResponse.json(shopWith(menu("m1", 5, false)))
      })
    )
    const { user } = renderCard(shopWith(menu("m1", 5)))

    await user.click(screen.getByRole("button", { name: /add/i }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Sorry — item-m1 just sold out."
    )
    await waitFor(() => expect(shopFetches).toBe(1))
    expect(await screen.findByText("Sold out")).toBeInTheDocument()
  })

  it("says the table isn't taking orders when it was deleted", async () => {
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/addItem`, () =>
        HttpResponse.json({ message: "Table Not Found!" }, { status: 404 })
      )
    )
    const { user } = renderCard(shopWith(menu("m1", 5)))

    await user.click(screen.getByRole("button", { name: /add/i }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      "This table isn't taking orders any more — please ask staff."
    )
  })

  it("shows a generic message when Add fails for any other reason", async () => {
    server.use(
      http.post(`${BASE}/carts/s1/tables/t1/addItem`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 })
      )
    )
    const { user } = renderCard(shopWith(menu("m1", 5)))

    await user.click(screen.getByRole("button", { name: /add/i }))

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Couldn't add this to your cart — please try again."
    )
  })
})

describe("cart with a sold-out item", () => {
  // m1 (£4.50 × 2) is fine; m2 (£3 × 3, one already paid) has sold out.
  const baseCart = (): ICart => ({
    _id: "cart1",
    userId: "u1",
    tableId: "t1",
    status: "open",
    items: [
      { _id: "i1", menuId: menu("m1", 4.5), qty: 2, qtyPayed: 0 },
      { _id: "i2", menuId: menu("m2", 3, false), qty: 3, qtyPayed: 1 },
    ],
    split: [
      { _id: "s-paid", userId: "u2", menuId: menu("m2", 3, false), qty: 1, splitStatus: "closed" },
    ],
  })

  let cartState: ICart
  const added: string[] = []
  const removed: string[] = []

  const mySplit = (menuId: string) =>
    cartState.split.find(
      (s) =>
        s.splitStatus === "open" &&
        s.userId === "u1" &&
        (typeof s.menuId === "string" ? s.menuId : s.menuId?._id) === menuId
    )

  beforeEach(() => {
    cartState = baseCart()
    added.length = 0
    removed.length = 0
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cartState)),
      http.post(
        `${BASE}/carts/:shopId/tables/:tableId/:cartId/addSplitItem`,
        async ({ request }) => {
          const { menuId, qty } = (await request.json()) as { menuId: string; qty: number }
          added.push(menuId)
          const item = cartState.items.find(
            (i) => (typeof i.menuId === "string" ? i.menuId : i.menuId?._id) === menuId
          )
          cartState.split.push({ _id: `s-${menuId}`, userId: "u1", menuId: item!.menuId, qty, splitStatus: "open" })
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
  })

  const renderCart = () =>
    renderWithProviders(<CartListItems />, {
      preloadedState: {
        user: { data: me, status: "authenticated" },
        // A copy: the store freezes what it's given, and the mock mutates cartState.
        carts: { data: structuredClone(cartState), pointers: { shopId: "s1", tableId: "t1" } },
      },
      route: "/shops/s1/tables/t1/cart",
      path: "/shops/:shopId/tables/:tableId/cart",
    })

  // Checkbox order in the DOM: [Select All, item i1, item i2 (sold out)].
  const boxes = () => screen.getAllByRole("checkbox")

  it("flags the row: badge, explanation, paid units, locked checkbox, bin", () => {
    renderCart()

    expect(screen.getByText("Sold out")).toBeInTheDocument()
    expect(
      screen.getByText(/No longer available — you won't be charged for it\. 1 already paid\./)
    ).toBeInTheDocument()
    expect(boxes()[2]).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remove item-m2 from the cart" })).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "1 item sold out after it was added. It won't be charged — remove it to pay for the rest."
    )
  })

  it("treats a menu item deleted since it was added as sold out, with a placeholder photo", () => {
    // The BE's stand-in for a deleted menu item: its id, no image, unavailable.
    cartState.items[1].menuId = {
      _id: "m2",
      name: "No longer on the menu",
      short_description: "",
      price: 0,
      available: false,
    } as IMenu
    renderCart()

    const row = screen.getByText("No longer on the menu").closest(".CartItem")!
    expect(row).toHaveClass("sold-out")
    expect(row.querySelector("img")?.getAttribute("src")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Remove No longer on the menu from the cart" })).toBeInTheDocument()
  })

  it("lets a selection made before the item sold out be un-ticked", async () => {
    cartState.split.push({ _id: "s-m2", userId: "u1", menuId: menu("m2", 3, false), qty: 2, splitStatus: "open" })
    const { user } = renderCart()

    expect(boxes()[2]).toBeChecked()
    expect(boxes()[2]).not.toBeDisabled()
    // Removing stays possible while it's selected.
    expect(screen.getByRole("button", { name: "Remove item-m2 from the cart" })).toBeInTheDocument()

    await user.click(boxes()[2])

    await waitFor(() => expect(removed).toEqual(["m2"]))
    await waitFor(() => expect(boxes()[2]).toBeDisabled())
    expect(boxes()[2]).not.toBeChecked()
  })

  it("Select All skips the sold-out item and still ticks", async () => {
    const { user } = renderCart()

    await user.click(boxes()[0])

    await waitFor(() => expect(added).toEqual(["m1"]))
    await waitFor(() => expect(boxes()[0]).toBeChecked())
  })

  it("leaves sold-out unpaid units out of the totals but keeps the paid ones", () => {
    renderCart()

    // Total = 2 × 4.50 (m1) + 1 paid × 3 (m2) = 12; the 2 unpaid m2 units are
    // not owed. Minus the £3 paid, £9 remains (it was £15 before sold-out
    // units were left out).
    expect(screen.getByText(/Remaining Cart Total/)).toHaveTextContent("£9.00")
    expect(screen.getByText(/Total Payed/)).toHaveTextContent("£3.00")
  })

  it("disables checkout with an explanation while I hold a sold-out selection", async () => {
    cartState.split.push({ _id: "s-m1", userId: "u1", menuId: menu("m1", 4.5), qty: 1, splitStatus: "open" })
    cartState.split.push({ _id: "s-m2", userId: "u1", menuId: menu("m2", 3, false), qty: 2, splitStatus: "open" })
    const { user } = renderCart()

    const blocked = screen.getByRole("button", { name: "Remove sold-out items to check out" })
    expect(blocked).toBeDisabled()

    await user.click(boxes()[2]) // un-select it

    expect(await screen.findByRole("button", { name: /CheckOut/ })).toBeEnabled()
  })
})

describe("checkout onApprove 409s", () => {
  const cart: ICart = {
    _id: "cart1",
    userId: "u1",
    tableId: "t1",
    status: "open",
    items: [],
    split: [],
  }

  const approveWith = async (message: string, status = 409) => {
    let cartFetches = 0
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () =>
        HttpResponse.json({ message }, { status })
      ),
      http.get(`${BASE}/carts/tables/t1`, () => {
        cartFetches++
        return HttpResponse.json(cart)
      })
    )
    const handleShowFbk = vi.fn()
    const { user } = renderWithProviders(
      <CheckOut show handleClose={() => {}} handleShowFbk={handleShowFbk} />,
      { preloadedState: { carts: { data: cart, pointers: { shopId: "s1", tableId: "t1" } } } }
    )

    await user.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(handleShowFbk).toHaveBeenCalled())
    await waitFor(() => expect(cartFetches).toBe(1))
    return handleShowFbk.mock.calls[0]
  }

  it("says nothing was charged when the BE refused before capture (sold out)", async () => {
    const msg = "Some items you selected are sold out — remove them to pay for the rest"
    const [variant, text] = await approveWith(msg)

    expect(variant).toBe("failure")
    expect(text).toBe(`${msg} — nothing was charged.`)
    expect(text).not.toMatch(/refunded/)
  })

  it("says nothing was charged when the table was closed meanwhile (404)", async () => {
    const [variant, text] = await approveWith("Cart Not Found!", 404)

    expect(variant).toBe("failure")
    expect(text).toBe("Cart Not Found! — nothing was charged.")
  })

  it("asks to contact staff, without claiming a payment, when the outcome is unknown", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () =>
        HttpResponse.json({ message: "Internal Server Error" }, { status: 500 })
      )
    )
    const handleShowFbk = vi.fn()
    const { user } = renderWithProviders(
      <CheckOut show handleClose={() => {}} handleShowFbk={handleShowFbk} />,
      { preloadedState: { carts: { data: cart, pointers: { shopId: "s1", tableId: "t1" } } } }
    )

    await user.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() =>
      expect(handleShowFbk).toHaveBeenCalledWith(
        "failure",
        "We couldn't confirm your payment — please contact staff before paying again."
      )
    )
  })

  it("shows the BE's contact-staff message, with its order id, as it is", async () => {
    const msg = "Payment captured but could not be settled or refunded — please contact staff (order ORDER-9)"
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () =>
        HttpResponse.json({ message: msg }, { status: 500 })
      )
    )
    const handleShowFbk = vi.fn()
    const { user } = renderWithProviders(
      <CheckOut show handleClose={() => {}} handleShowFbk={handleShowFbk} />,
      { preloadedState: { carts: { data: cart, pointers: { shopId: "s1", tableId: "t1" } } } }
    )

    await user.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(handleShowFbk).toHaveBeenCalledWith("failure", msg))
  })

  it("says the payment is under review, and not to pay again, on a 202", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () =>
        HttpResponse.json({ ...cart, status: "open" }, { status: 202 })
      )
    )
    const handleShowFbk = vi.fn()
    const { user } = renderWithProviders(
      <CheckOut show handleClose={() => {}} handleShowFbk={handleShowFbk} />,
      { preloadedState: { carts: { data: cart, pointers: { shopId: "s1", tableId: "t1" } } } }
    )

    await user.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() =>
      expect(handleShowFbk).toHaveBeenCalledWith(
        "failure",
        "PayPal is still reviewing your payment. Your items are held for you until staff confirm it — please don't pay for them again."
      )
    )
    expect(handleShowFbk).toHaveBeenCalledTimes(1)
  })

  it("says refunded, once, for the post-capture conflict", async () => {
    const [, text] = await approveWith(
      "The table's cart changed while you were paying — your payment was refunded"
    )

    expect(text).toBe("The table's cart changed while you were paying — your payment was refunded.")
  })
})
