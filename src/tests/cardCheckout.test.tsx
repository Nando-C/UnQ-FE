import { StrictMode } from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { http, HttpResponse } from "msw"
import Cart from "../components/Customers/Cart/Cart"
import { gate, makeStore } from "./helpers"
import { fetchUserData, logOut } from "../redux/slices/userSlice"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"

// Stripe.js can't load in jsdom: Elements and the Payment Element are stood in
// for. `elementsOptions` keeps the options Elements was rendered with, each
// render; `submit` and `confirmPayment` answer as each test says (as Stripe.js
// does once the diner fills the form and confirms). `calls` keeps the order of
// the press's steps.
const { confirmPayment, submit, element, elementsOptions, calls, paypalProps } = vi.hoisted(() => ({
  confirmPayment: vi.fn(),
  submit: vi.fn(),
  // `options`: what the Payment Element was last rendered with.
  element: { fails: false, options: undefined as Record<string, unknown> | undefined },
  elementsOptions: [] as Record<string, unknown>[],
  calls: [] as string[],
  paypalProps: [] as Record<string, unknown>[],
}))
vi.mock("@stripe/stripe-js/pure", () => ({ loadStripe: vi.fn(async () => ({ confirmPayment })) }))
vi.mock("@stripe/react-stripe-js", async () => {
  const { useEffect } = await import("react")
  return {
    Elements: ({ options, children }: { options: Record<string, unknown>; children: React.ReactNode }) => {
      elementsOptions.push(options)
      return children
    },
    PaymentElement: ({ options, onReady, onLoadError }: { options?: Record<string, unknown>; onReady?: () => void; onLoadError?: () => void }) => {
      element.options = options
      useEffect(() => {
        if (element.fails) onLoadError?.()
        else onReady?.()
      }, [onReady, onLoadError])
      return <div>Card details</div>
    },
    useStripe: () => ({ confirmPayment }),
    useElements: () => ({ submit }),
  }
})
// PayPal's button opens its popup (createOrder); "Cancel PayPal" closes it.
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ children }: { children: React.ReactNode }) => children,
  PayPalButtons: (props: { createOrder: () => Promise<string>; onCancel: () => void; disabled?: boolean }) => {
    paypalProps.push(props)
    return (
      <>
        <button onClick={() => void props.createOrder().catch(() => {})}>PayPal</button>
        <button onClick={props.onCancel}>Cancel PayPal</button>
      </>
    )
  },
}))

const latte: IMenu = { _id: "m1", name: "Latte", image: "", short_description: "", description: "", price: 3, available: true, category: "drinks" }
const me = { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" }
// I've selected the one latte to pay for.
const cart: ICart = {
  _id: "cart1", userId: "u1", tableId: "t1", status: "open",
  items: [{ _id: "i1", menuId: latte, qty: 1, qtyPayed: 0 }],
  split: [{ _id: "sp1", userId: "u1", menuId: latte, qty: 1, splitStatus: "open" }],
}
const paidCart: ICart = {
  ...cart, status: "closed",
  items: [{ _id: "i1", menuId: latte, qty: 1, qtyPayed: 1 }],
  split: [{ _id: "sp1", userId: "u1", menuId: latte, qty: 1, splitStatus: "closed", unitPrice: 3 }],
}
// The same cart with my selection at `qty` lattes of `price` each.
const selecting = (qty: number, price = 3): ICart => {
  const menuId = { ...latte, price }
  return {
    ...cart,
    items: [{ ...cart.items[0], menuId, qty: Math.max(qty, 1) }],
    split: qty ? [{ ...cart.split[0], menuId, qty }] : [],
  }
}
const CANT_START = "Card payments aren't available right now. Try again, or choose PayPal."
const COULDNT_START = "Couldn't start the card payment. Try again in a moment, or pay with PayPal."
const NOTHING_SELECTED = "Nothing selected to pay for"
const STILL_CONFIRMING =
  "We're still confirming your payment. Your cart will update once it's confirmed, and you'll get a note if it doesn't go through — until then, please don't pay for these items again (payment pi_1)"

// What the BE was asked, and what it answers.
let cartGets: Record<string, number>
let created: number
let captures: { url: string; body: unknown }[]
let captureAnswer: () => Response | Promise<Response>
let createAnswer: () => Response | Promise<Response>
// The table's cart as the BE has it now.
let tableCart: ICart

// The URL the diner is at, as the router has it.
const Where = () => {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}
// Moves to table t2's cart, as the bottom bar's link would.
const GoToT2 = () => {
  const navigate = useNavigate()
  return <button onClick={() => navigate("/shops/s1/tables/t2/cart")}>to table 2</button>
}

// `reloaded`: the page as a return from Stripe finds it, the cart not loaded
// (and, with `sessionLoading`, not yet who's signed in).
const renderCart = ({ at = "/shops/s1/tables/t1/cart", reloaded = false, strict = false, sessionLoading = false, shown = cart } = {}) => {
  const store = makeStore({
    ...(!sessionLoading && { user: { data: me, status: "authenticated" } }),
    ...(!reloaded && { carts: { data: structuredClone(shown), pointers: { shopId: "s1", tableId: "t1" } } }),
  })
  const tree = (
    <Provider store={store}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route
            path="/shops/:shopId/tables/:tableId/cart"
            element={
              <>
                <Cart />
                <Where />
                <GoToT2 />
              </>
            }
          />
          <Route path="/shops/:shopId/tables/:tableId" element={<p>table menu</p>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  render(strict ? <StrictMode>{tree}</StrictMode> : tree)
  return store
}

type User = ReturnType<typeof userEvent.setup>
// PayPal's button, at the top of the sheet.
const paypalButton = () => screen.getByRole("button", { name: "PayPal" })
// Opens the checkout sheet; `openSheet` also waits for its card form.
const clickCheckout = async (user: User) => user.click(await screen.findByRole("button", { name: /Check out/ }))
const openSheet = async (user: User, pay = "Pay £3.00") => {
  await clickCheckout(user)
  return screen.findByRole("button", { name: pay })
}
const payByCard = async (user: User) => user.click(await openSheet(user))
// The bottom sheet titled `title` (a payment's outcome, or the checkout).
const sheetTitled = async (title: string) => (await screen.findByText(title)).closest(".offcanvas") as HTMLElement
const feedback = sheetTitled
// The options Elements was last rendered with.
const lastOptions = () => elementsOptions.at(-1)
// The table's cart as a refetch on coming back to the tab finds it.
const refetchFinds = async (found: ICart) => {
  tableCart = found
  const before = cartGets.t1 ?? 0
  window.dispatchEvent(new Event("focus"))
  await waitFor(() => expect(cartGets.t1).toBeGreaterThan(before))
}

beforeEach(() => {
  vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_123")
  confirmPayment.mockReset()
  submit.mockReset()
  element.fails = false
  element.options = undefined
  elementsOptions.length = 0
  calls.length = 0
  paypalProps.length = 0
  submit.mockImplementation(async () => {
    calls.push("submit")
    return {}
  })
  confirmPayment.mockImplementation(async () => {
    calls.push("confirm")
    return { paymentIntent: { status: "requires_capture" } }
  })
  cartGets = {}
  created = 0
  captures = []
  tableCart = cart
  captureAnswer = () => HttpResponse.json(paidCart)
  createAnswer = () => HttpResponse.json({ clientSecret: `pi_${created}_secret_x`, paymentIntentId: `pi_${created}`, amount: 300 })
  server.use(
    http.get(`${BASE}/carts/tables/:tableId`, ({ params }) => {
      const tableId = params.tableId as string
      cartGets[tableId] = (cartGets[tableId] ?? 0) + 1
      return tableId === "t1"
        ? HttpResponse.json(tableCart)
        : HttpResponse.json({ message: "Cart Not Found!", notices: [] }, { status: 404 })
    }),
    http.get(`${BASE}/shops/s1`, () =>
      HttpResponse.json({
        _id: "s1", name: "Cafe", menu: [latte],
        tables: [{ _id: "t1", name: "Window", Qr_Url: "" }, { _id: "t2", name: "Door", Qr_Url: "" }],
      })
    ),
    http.post(`${BASE}/carts/tables/t1/cart1/createStripeCheckout`, () => {
      created += 1
      calls.push("create")
      return createAnswer()
    }),
    http.post(`${BASE}/carts/tables/t1/cart1/captureStripeCheckout`, async ({ request }) => {
      captures.push({ url: request.url, body: await request.json() })
      return captureAnswer()
    })
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe("the checkout sheet", () => {
  it("offers only PayPal, and starts no card payment, without a Stripe key", async () => {
    vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "")
    renderCart()
    const user = userEvent.setup()

    await clickCheckout(user)

    expect(await screen.findByRole("button", { name: "PayPal" })).toBeInTheDocument()
    expect(screen.queryByText("or")).not.toBeInTheDocument()
    expect(screen.queryByText("Card details")).not.toBeInTheDocument()
    expect(elementsOptions).toEqual([])
    // PayPal's card button stays: it's the only way to pay by card then
    // (PayPal draws it only in its vertical layout).
    expect(paypalProps.at(-1)?.fundingSource).toBeUndefined()
    expect(paypalProps.at(-1)?.style).toBeUndefined()
    expect(created).toBe(0)
  })

  it("opens on PayPal's button, then the card form, ready for the amount shown, creating nothing", async () => {
    renderCart()
    const user = userEvent.setup()

    const pay = await openSheet(user)

    const sheet = pay.closest(".offcanvas") as HTMLElement
    expect(within(sheet).getByText("Paying £3.00 for your selection")).toBeInTheDocument()
    // Top to bottom: PayPal, "or", the card form (Stripe puts Apple Pay and
    // Google Pay at the top of its form, where the device has one).
    const paypal = within(sheet).getByRole("button", { name: "PayPal" })
    const or = within(sheet).getByText("or")
    const form = within(sheet).getByText("Card details")
    expect(paypal.compareDocumentPosition(or) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(or.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(sheet).getAllByRole("button", { name: "PayPal" })).toHaveLength(1)
    expect(paypalProps.at(-1)).toMatchObject({ fundingSource: "paypal" })
    expect(lastOptions()).toEqual({
      mode: "payment",
      amount: 300,
      currency: "gbp",
      captureMethod: "manual",
      allowedPaymentMethodTypes: ["card"],
    })
    // No Link (Stripe's own saved-card wallet, which asks for an email to
    // sign up): Apple Pay and Google Pay stay as Stripe decides.
    expect(element.options).toEqual({ wallets: { link: "never" } })
    expect(created).toBe(0)
  })

  it("at Pay, submits the form, then creates the payment, then confirms it with its secret and a return URL naming the cart, then has the BE capture it", async () => {
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    await feedback("Payment successful")
    expect(calls).toEqual(["submit", "create", "confirm"])
    expect(confirmPayment).toHaveBeenCalledTimes(1)
    const [{ clientSecret, redirect, confirmParams }] = confirmPayment.mock.calls[0]
    expect(clientSecret).toBe("pi_1_secret_x")
    expect(redirect).toBe("if_required")
    expect(confirmParams.return_url).toBe("http://localhost:3000/shops/s1/tables/t1/cart?cart=cart1")
    expect(captures).toEqual([
      { url: expect.stringContaining("/carts/tables/t1/cart1/captureStripeCheckout"), body: { paymentIntentId: "pi_1" } },
    ])
  })

  it("disables Pay and PayPal, and keeps the sheet open, while it's being sent", async () => {
    let finish!: (value: unknown) => void
    confirmPayment.mockReturnValue(new Promise((resolve) => (finish = resolve)))
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    expect(await screen.findByRole("button", { name: "Paying…" })).toBeDisabled()
    expect(paypalProps.at(-1)).toMatchObject({ disabled: true })
    const sheet = await sheetTitled("Select Payment Type")
    expect(within(sheet).queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.getByRole("button", { name: "Paying…" })).toBeInTheDocument()
    finish({ paymentIntent: { status: "requires_capture" } })
    await feedback("Payment successful")
  })

  it("opens with its form ready again, after being closed", async () => {
    renderCart()
    const user = userEvent.setup()
    await openSheet(user)
    const sheet = await sheetTitled("Select Payment Type")
    await user.click(within(sheet).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByText("Select Payment Type")).not.toBeInTheDocument())

    await openSheet(user)

    expect(created).toBe(0)
  })

  it("can be closed again after a decline", async () => {
    confirmPayment.mockResolvedValueOnce({ error: { type: "card_error", message: "Your card was declined." } })
    renderCart()
    const user = userEvent.setup()
    await payByCard(user)
    await screen.findByRole("alert")
    const sheet = await sheetTitled("Select Payment Type")

    await user.click(within(sheet).getByRole("button", { name: "Close" }))

    await waitFor(() => expect(screen.queryByText("Select Payment Type")).not.toBeInTheDocument())
  })
})

describe("the amount a card pays", () => {
  // £1.15 is 114.99999999999999 pence as a float.
  it("is counted in whole pence, so a float total (£1.15) matches the BE's", async () => {
    tableCart = selecting(1, 1.15)
    createAnswer = () => HttpResponse.json({ clientSecret: "pi_1_secret_x", paymentIntentId: "pi_1", amount: 115 })
    renderCart({ shown: selecting(1, 1.15) })
    const user = userEvent.setup()

    await user.click(await openSheet(user, "Pay £1.15"))

    await feedback("Payment successful")
    expect(lastOptions()).toMatchObject({ amount: 115 })
    expect(confirmPayment).toHaveBeenCalledTimes(1)
  })

  it("follows the selection while the form is open", async () => {
    renderCart()
    const user = userEvent.setup()
    await openSheet(user)

    await refetchFinds(selecting(2))

    expect(await screen.findByRole("button", { name: "Pay £6.00" })).toBeInTheDocument()
    expect(lastOptions()).toMatchObject({ amount: 600 })
    expect(screen.getByText("Paying £6.00 for your selection")).toBeInTheDocument()
  })

  it("is the one pressed, shown and checked, whatever a refetch finds before the BE answers", async () => {
    const held = gate()
    createAnswer = async () => {
      await held.opened
      return HttpResponse.json({ clientSecret: "pi_1_secret_x", paymentIntentId: "pi_1", amount: 300 })
    }
    renderCart()
    const user = userEvent.setup()
    await payByCard(user)
    await waitFor(() => expect(created).toBe(1))

    await refetchFinds({ ...selecting(2), _id: "cart2" })
    await waitFor(() => expect(screen.getByRole("button", { name: /Check out/ })).toHaveTextContent("£6.00"))

    expect(screen.getByText("Paying £3.00 for your selection")).toBeInTheDocument()
    expect(lastOptions()).toMatchObject({ amount: 300 })
    held.open()
    await feedback("Payment successful")
    expect(confirmPayment).toHaveBeenCalledTimes(1)
    expect(captures[0].url).toContain("/carts/tables/t1/cart1/captureStripeCheckout")
    expect(confirmPayment.mock.calls[0][0].confirmParams.return_url).toContain("?cart=cart1")
  })

  it("is never confirmed when the BE's differs: its amount is said, the cart refetched, and the next press pays", async () => {
    createAnswer = () => HttpResponse.json({ clientSecret: `pi_${created}_secret_x`, paymentIntentId: `pi_${created}`, amount: 350 })
    renderCart()
    const user = userEvent.setup()
    const first = await openSheet(user)
    // The BE's prices, as the refetch finds them.
    tableCart = selecting(1, 3.5)
    const before = cartGets.t1 ?? 0

    await user.click(first)

    expect(await screen.findByRole("alert")).toHaveTextContent("The total is now £3.50 — check it and press Pay again.")
    expect(confirmPayment).not.toHaveBeenCalled()
    await waitFor(() => expect(cartGets.t1).toBeGreaterThan(before))
    const pay = await screen.findByRole("button", { name: "Pay £3.50" })
    expect(lastOptions()).toMatchObject({ amount: 350 })

    await user.click(pay)

    await feedback("Payment successful")
    expect(created).toBe(2)
    expect(captures.map((c) => c.body)).toEqual([{ paymentIntentId: "pi_2" }])
  })

  it("confirms nothing when the BE's answer has no amount", async () => {
    createAnswer = () => HttpResponse.json({ clientSecret: "pi_1_secret_x", paymentIntentId: "pi_1" })
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    expect(await screen.findByRole("alert")).toHaveTextContent(COULDNT_START)
    expect(confirmPayment).not.toHaveBeenCalled()
    expect(captures).toEqual([])
    expect(screen.getByRole("button", { name: "Pay £3.00" })).toBeEnabled()
  })

  it("stays positive in the form when the selection empties under it, and Pay says there's nothing to pay for", async () => {
    renderCart()
    const user = userEvent.setup()
    await openSheet(user)

    await refetchFinds(selecting(0))

    expect(await screen.findByRole("button", { name: NOTHING_SELECTED })).toBeDisabled()
    expect(lastOptions()).toMatchObject({ amount: 300 })
    expect(screen.getByText("Card details")).toBeInTheDocument()
  })
})

describe("how a card payment ended", () => {
  it.each([
    ["paid", () => HttpResponse.json(paidCart), "Payment successful", "Your payment went through."],
    [
      "held while Stripe processes it (202)",
      () => HttpResponse.json(cart, { status: 202 }),
      "Payment under review",
      "Stripe is still confirming your payment. Your items are held for you — please don't pay for them again.",
    ],
    [
      "refunded after a lost race",
      () => HttpResponse.json({ message: "The table's cart changed while you were paying — your payment was refunded" }, { status: 409 }),
      "Payment not completed",
      "The table's cart changed while you were paying — your payment was refunded.",
    ],
    [
      "refused, nothing charged",
      () => HttpResponse.json({ message: "Payment not completed — nothing was charged" }, { status: 402 }),
      "Payment not completed",
      "Payment could not be completed — nothing was charged. Please try again.",
    ],
    [
      "unknown, with the payment id for staff",
      () => HttpResponse.json({ message: "Payment captured but could not be recorded or refunded — please contact staff (payment pi_1)" }, { status: 500 }),
      "Payment not completed",
      "Payment captured but could not be recorded or refunded — please contact staff (payment pi_1)",
    ],
    [
      "handed to staff while the diner disputes it",
      () => HttpResponse.json({ message: "Payment captured but couldn't be refunded to your card while you dispute it: your bank returns it (payment pi_1)" }, { status: 500 }),
      "Payment not completed",
      "Payment captured but couldn't be refunded to your card while you dispute it: your bank returns it (payment pi_1)",
    ],
    [
      "an error the BE didn't explain, which its webhook finishes",
      () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }),
      "Confirming your payment",
      "We couldn't hear back about your card payment. Your cart will update once it's confirmed, and you'll get a note if it doesn't go through — until then, please don't pay for these items again.",
    ],
    [
      "no answer at all",
      () => HttpResponse.error(),
      "Confirming your payment",
      "We couldn't hear back about your card payment. Your cart will update once it's confirmed, and you'll get a note if it doesn't go through — until then, please don't pay for these items again.",
    ],
    [
      "paid, on a cart deleted since",
      () => HttpResponse.json({ message: "Your card payment went through, but this table's cart is no longer here" }, { status: 404 }),
      "Payment successful",
      "Your card payment went through, but this table's cart is no longer here",
    ],
    [
      "being confirmed, on a cart deleted since",
      () => HttpResponse.json({ message: "Your card payment is being confirmed, but this table's cart is no longer here" }, { status: 404 }),
      "Payment under review",
      "Your card payment is being confirmed, but this table's cart is no longer here",
    ],
    [
      "paid, on a cart deleted since, told by its reason code whatever the wording",
      () => HttpResponse.json({ message: "Your card payment went through; the table has gone", reason: "CART_GONE" }, { status: 404 }),
      "Payment successful",
      "Your card payment went through; the table has gone",
    ],
    [
      "being confirmed, on a cart deleted since, told by its reason code whatever the wording",
      () => HttpResponse.json({ message: "Your card payment is still being confirmed; the table has gone", reason: "CART_GONE_PENDING" }, { status: 404 }),
      "Payment under review",
      "Your card payment is still being confirmed; the table has gone",
    ],
    [
      "unknown because the diner is signed out",
      () => HttpResponse.json({ message: "Unauthorized" }, { status: 401 }),
      "Confirming your payment",
      "We couldn't check your card payment because you're signed out. Sign in to see how it went — until then, please don't pay for these items again.",
    ],
  ])("%s", async (_, answer, title, text) => {
    captureAnswer = answer
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    const sheet = await feedback(title)
    expect(within(sheet).getByText(text)).toBeInTheDocument()
    // Only a refusal says nothing was charged.
    expect(screen.queryAllByText(/nothing was charged/)).toHaveLength(text.includes("nothing was charged") ? 1 : 0)
  })
})

describe("a card the diner can try again", () => {
  it.each([
    ["a decline", { type: "card_error", code: "card_declined", message: "Your card was declined." }],
    [
      "a failed bank check",
      { type: "invalid_request_error", code: "payment_intent_authentication_failure", message: "We are unable to authenticate your payment method." },
    ],
  ])("keeps the sheet open after %s, with why, and pays with another card on a new payment", async (_, error) => {
    confirmPayment.mockResolvedValueOnce({ error })
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    expect(await screen.findByRole("alert")).toHaveTextContent(error.message)
    expect(captures).toEqual([])
    const pay = screen.getByRole("button", { name: "Pay £3.00" })
    expect(pay).toBeEnabled()

    await user.click(pay)

    await feedback("Payment successful")
    expect(created).toBe(2)
    expect(captures.map((c) => c.body)).toEqual([{ paymentIntentId: "pi_2" }])
  })

  it("leaves a form error to Stripe's form, creating nothing, and pays once it's fixed", async () => {
    submit.mockResolvedValueOnce({ error: { type: "validation_error", code: "incomplete_number", message: "Your card number is incomplete." } })
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    const pay = await screen.findByRole("button", { name: "Pay £3.00" })
    await waitFor(() => expect(pay).toBeEnabled())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(created).toBe(0)
    await user.click(pay)
    await feedback("Payment successful")
    expect(created).toBe(1)
  })

  it("shows any other error from the form under it, creating nothing", async () => {
    submit.mockResolvedValueOnce({ error: { type: "invalid_request_error", message: "Google Pay isn't available right now." } })
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    expect(await screen.findByRole("alert")).toHaveTextContent("Google Pay isn't available right now.")
    expect(created).toBe(0)
    expect(screen.getByRole("button", { name: "Pay £3.00" })).toBeEnabled()
  })

  it("says it couldn't start, creating nothing, when the form throws at Pay", async () => {
    submit.mockImplementationOnce(() => {
      throw new Error("IntegrationError: the Payment Element was destroyed")
    })
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    expect(await screen.findByRole("alert")).toHaveTextContent(COULDNT_START)
    expect(created).toBe(0)
    expect(screen.getByRole("button", { name: "Pay £3.00" })).toBeEnabled()
  })

  it("asks the BE how it ended after any other error, which may come after the card was authorised", async () => {
    confirmPayment.mockResolvedValueOnce({ error: { type: "api_connection_error", message: "Network error" } })
    captureAnswer = () => HttpResponse.json(cart, { status: 202 })
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    await feedback("Payment under review")
    expect(captures.map((c) => c.body)).toEqual([{ paymentIntentId: "pi_1" }])
  })

  it("asks the BE when confirming throws", async () => {
    confirmPayment.mockRejectedValueOnce(new Error("offline"))
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    await feedback("Payment successful")
    expect(captures).toHaveLength(1)
  })

  it("starts a new payment when the sheet opens again after a capture's answer", async () => {
    captureAnswer = () => HttpResponse.json({ message: "Payment not completed — nothing was charged" }, { status: 402 })
    renderCart()
    const user = userEvent.setup()
    await payByCard(user)
    const sheet = await feedback("Payment not completed")
    await user.click(within(sheet).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByText("Payment not completed")).not.toBeInTheDocument())
    captureAnswer = () => HttpResponse.json(paidCart)

    await payByCard(user)

    await feedback("Payment successful")
    expect(created).toBe(2)
    expect(captures.map((c) => c.body)).toEqual([{ paymentIntentId: "pi_1" }, { paymentIntentId: "pi_2" }])
  })
})

describe("an open card form", () => {
  it("sends one payment for a double tap", async () => {
    renderCart()
    const user = userEvent.setup()
    const pay = await openSheet(user)

    const form = pay.closest("form") as HTMLFormElement
    fireEvent.submit(form)
    fireEvent.submit(form)

    await feedback("Payment successful")
    expect(submit).toHaveBeenCalledTimes(1)
    expect(created).toBe(1)
    expect(confirmPayment).toHaveBeenCalledTimes(1)
    expect(captures).toHaveLength(1)
  })
})

describe("one payment at a time in the sheet", () => {
  it("holds the card's Pay while PayPal's popup is open, and frees it when it's closed", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/createCheckoutOrder`, () => HttpResponse.json({ paypalOrderId: "order1" }))
    )
    renderCart()
    const user = userEvent.setup()
    const pay = await openSheet(user)

    await user.click(paypalButton())
    await waitFor(() => expect(pay).toBeDisabled())
    await user.click(screen.getByRole("button", { name: "Cancel PayPal" }))

    await feedback("Payment not completed")
    await user.click(await openSheet(user))
    await feedback("Payment successful")
  })
})

describe("starting a card payment, at Pay", () => {
  it.each([
    ["too many changes in a minute", () => HttpResponse.json({ message: "Too many changes to your order — wait a minute and try again" }, { status: 429 })],
    ["Stripe can't start it", () => HttpResponse.json({ message: "Could not start a card payment" }, { status: 502 })],
    ["no answer", () => HttpResponse.error()],
  ])("keeps the sheet, and PayPal, when %s, and the next press starts it", async (_, answer) => {
    createAnswer = answer
    renderCart()
    const user = userEvent.setup()

    await payByCard(user)

    expect(await screen.findByRole("alert")).toHaveTextContent(COULDNT_START)
    expect(confirmPayment).not.toHaveBeenCalled()
    expect(paypalProps.at(-1)).toMatchObject({ disabled: false })
    expect(screen.queryByText("Payment not completed")).not.toBeInTheDocument()
    createAnswer = () => HttpResponse.json({ clientSecret: "pi_2_secret_x", paymentIntentId: "pi_2", amount: 300 })

    await user.click(screen.getByRole("button", { name: "Pay £3.00" }))

    await feedback("Payment successful")
    expect(created).toBe(2)
  })

  it("closes the sheet with the BE's reason when its checks refuse it, and refreshes the cart", async () => {
    createAnswer = () => HttpResponse.json({ message: "Some items you selected are sold out" }, { status: 409 })
    renderCart()
    const user = userEvent.setup()
    await screen.findByRole("button", { name: /Check out/ })
    const before = cartGets.t1 ?? 0

    await payByCard(user)

    const sheet = await feedback("Payment not completed")
    expect(within(sheet).getByText("Some items you selected are sold out — nothing was charged.")).toBeInTheDocument()
    expect(confirmPayment).not.toHaveBeenCalled()
    await waitFor(() => expect(cartGets.t1).toBeGreaterThan(before))
  })

  it("offers to try again, creating nothing, when Stripe's form can't load, and PayPal meanwhile", async () => {
    element.fails = true
    renderCart()
    const user = userEvent.setup()
    await clickCheckout(user)

    expect(await screen.findByText(CANT_START)).toBeInTheDocument()
    expect(paypalProps.at(-1)).toMatchObject({ disabled: false })
    element.fails = false

    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByRole("button", { name: "Pay £3.00" })).toBeInTheDocument()
    expect(created).toBe(0)
  })

  it("creates nothing on opening, with its form ready, even when React runs effects twice, and one payment per press", async () => {
    renderCart({ strict: true })
    const user = userEvent.setup()

    const pay = await openSheet(user)
    expect(created).toBe(0)
    await user.click(pay)

    await feedback("Payment successful")
    expect(created).toBe(1)
  })
})

describe("a card payment the BE is still confirming", () => {
  const stillConfirming = () => HttpResponse.json({ message: STILL_CONFIRMING, reason: "STILL_CONFIRMING" }, { status: 502 })

  it("shows the BE's message, promising nothing, and looks at the cart again after 30 s and 3 minutes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    captureAnswer = stillConfirming
    renderCart()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    await payByCard(user)

    const sheet = await feedback("Confirming your payment")
    expect(within(sheet).getByText(STILL_CONFIRMING)).toBeInTheDocument()
    expect(screen.queryByText(/items are held/)).not.toBeInTheDocument()
    const before = cartGets.t1
    await vi.advanceTimersByTimeAsync(29_000)
    expect(cartGets.t1).toBe(before)
    await vi.advanceTimersByTimeAsync(1_000)
    await waitFor(() => expect(cartGets.t1).toBe(before + 1))
    await vi.advanceTimersByTimeAsync(150_000)
    await waitFor(() => expect(cartGets.t1).toBe(before + 2))
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(cartGets.t1).toBe(before + 2)
  })

  it("looks again too at a payment Stripe is still processing (202)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    captureAnswer = () => HttpResponse.json(cart, { status: 202 })
    renderCart()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await payByCard(user)
    await feedback("Payment under review")
    const before = cartGets.t1

    await vi.advanceTimersByTimeAsync(30_000)

    await waitFor(() => expect(cartGets.t1).toBe(before + 1))
  })

  it("stops looking once the diner moves to another table", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    captureAnswer = stillConfirming
    renderCart()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await payByCard(user)
    await feedback("Confirming your payment")
    const before = cartGets.t1

    await user.click(screen.getByRole("button", { name: "to table 2" }))
    await waitFor(() => expect(cartGets.t2).toBeGreaterThan(0))
    await vi.advanceTimersByTimeAsync(5 * 60_000)

    expect(cartGets.t1).toBe(before)
  })
})

describe("back from a bank check that left the page", () => {
  it("stops looking at the cart again once the diner signs out, though the session loaded after the answer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    captureAnswer = () => HttpResponse.json({ message: STILL_CONFIRMING, reason: "STILL_CONFIRMING" }, { status: 502 })
    const store = renderCart({
      at: "/shops/s1/tables/t1/cart?cart=cart1&payment_intent=pi_1&redirect_status=succeeded",
      reloaded: true,
      sessionLoading: true,
    })
    await feedback("Confirming your payment")
    const answered = cartGets.t1
    // The session loads 25 s later: the first look stays at 30 s.
    await vi.advanceTimersByTimeAsync(25_000)
    store.dispatch(fetchUserData.fulfilled(me, "1"))
    await waitFor(() => expect(store.getState().user.data._id).toBe("u1"))
    await vi.advanceTimersByTimeAsync(5_000)
    await waitFor(() => expect(cartGets.t1).toBe(answered + 1))
    await waitFor(() => expect(store.getState().user.data._id).toBe("u1"))
    await vi.advanceTimersByTimeAsync(0)
    store.dispatch(logOut.fulfilled(undefined, "2"))
    const before = cartGets.t1

    await vi.advanceTimersByTimeAsync(5 * 60_000)

    expect(cartGets.t1).toBe(before)
  })

  const returnUrl = "/shops/s1/tables/t1/cart?cart=cart1&payment_intent=pi_9&payment_intent_client_secret=pi_9_secret&redirect_status=succeeded"

  it("asks the BE once about the cart and payment named in the URL, cleans the URL and shows the outcome", async () => {
    renderCart({ at: returnUrl, reloaded: true, strict: true })

    await feedback("Payment successful")
    expect(captures).toEqual([
      { url: expect.stringContaining("/carts/tables/t1/cart1/captureStripeCheckout"), body: { paymentIntentId: "pi_9" } },
    ])
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/shops\/s1\/tables\/t1\/cart$/)
  })

  it("shows a payment the webhook finished meanwhile, its cart closed", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json({ message: "Cart Not Found!", notices: [] }, { status: 404 }))
    )
    renderCart({ at: returnUrl, reloaded: true })

    await feedback("Payment successful")
    expect(await screen.findByText("No open orders")).toBeInTheDocument()
    expect(captures).toHaveLength(1)
  })

  it("offers no checkout while it asks", async () => {
    const held = gate()
    captureAnswer = async () => {
      await held.opened
      return HttpResponse.json(paidCart)
    }
    renderCart({ at: returnUrl, reloaded: true })

    expect(await screen.findByText("Checking your card payment…")).toBeInTheDocument()
    await waitFor(() => expect(cartGets.t1).toBeGreaterThan(0))
    expect(screen.queryByRole("button", { name: /Check out/ })).not.toBeInTheDocument()
    held.open()

    await feedback("Payment successful")
    expect(screen.queryByText("Checking your card payment…")).not.toBeInTheDocument()
  })

  it("shows nothing, and loads nothing, for a table the diner has left meanwhile", async () => {
    const held = gate()
    captureAnswer = async () => {
      await held.opened
      return HttpResponse.json(paidCart)
    }
    renderCart({ at: returnUrl, reloaded: true })
    const user = userEvent.setup()
    await screen.findByText("Checking your card payment…")
    await user.click(screen.getByRole("button", { name: "to table 2" }))
    await waitFor(() => expect(cartGets.t2).toBeGreaterThan(0))
    const before = cartGets.t1

    held.open()
    await new Promise((r) => setTimeout(r, 300))

    expect(screen.queryByText("Payment successful")).not.toBeInTheDocument()
    expect(cartGets.t1).toBe(before)
  })

  it("shows a refusal as it would in the sheet", async () => {
    captureAnswer = () => HttpResponse.json({ message: "Payment not completed — nothing was charged" }, { status: 402 })
    renderCart({ at: returnUrl, reloaded: true })

    await feedback("Payment not completed")
    expect(screen.getByText("Payment could not be completed — nothing was charged. Please try again.")).toBeInTheDocument()
  })

  it("asks nothing for a URL without a payment, and cleans it", async () => {
    renderCart({ at: "/shops/s1/tables/t1/cart?cart=cart1" })

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/shops\/s1\/tables\/t1\/cart$/))
    expect(captures).toEqual([])
  })
})

describe("a card payment's outcome in the cart's notices", () => {
  const notice = { _id: "pi_1:went", at: new Date().toISOString(), message: "Your card payment of £3.00 went through" }

  it("shows one sent with the open cart, until dismissed", async () => {
    server.use(http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json({ ...cart, notices: [notice] })))
    renderCart()
    const user = userEvent.setup()

    const shown = await screen.findByText(notice.message)
    await user.click(within(shown.closest(".alert") as HTMLElement).getByRole("button", { name: "Close alert" }))

    expect(screen.queryByText(notice.message)).not.toBeInTheDocument()
  })

  it("shows one sent with the 404 of a table with no open cart", async () => {
    server.use(
      http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json({ message: "Cart Not Found!", notices: [{ ...notice, _id: "pi_2:went" }] }, { status: 404 }))
    )
    renderCart()

    expect(await screen.findByText(notice.message)).toBeInTheDocument()
    expect(screen.getByText("No open orders")).toBeInTheDocument()
  })
})
