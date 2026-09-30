import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom"
import { http, HttpResponse } from "msw"
import Cart from "../components/Customers/Cart/Cart"
import PaymentFeedback from "../components/Customers/PaymentFeedback/PaymentFeedback"
import Login from "../components/Login/Login"
import { rememberReturnTo } from "../lib/returnTo"
import { makeStore } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"

// PayPal's SDK can't load in jsdom: its button is stood in for by one that
// approves, as the SDK does once the buyer approves in its popup.
vi.mock("@paypal/react-paypal-js", () => ({
  PayPalScriptProvider: ({ children }: { children: React.ReactNode }) => children,
  PayPalButtons: ({ onApprove }: { onApprove: (data: { orderID: string }) => Promise<void> }) => (
    <button onClick={() => onApprove({ orderID: "order1" })}>Approve</button>
  ),
}))

const latte: IMenu = { _id: "m1", name: "Latte", image: "", short_description: "", description: "", price: 3, available: true, category: "drinks" }
const me = { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" }
// I've selected the one latte to pay for.
const cart: ICart = {
  _id: "cart1", userId: "u1", tableId: "t1", status: "open",
  items: [{ _id: "i1", menuId: latte, qty: 1, qtyPayed: 0 }],
  split: [{ _id: "sp1", userId: "u1", menuId: latte, qty: 1, splitStatus: "open" }],
}

// A page that can go back a step, as the browser's Back does.
const Marker = ({ text }: { text: string }) => {
  const navigate = useNavigate()
  return (
    <>
      <p>{text}</p>
      <button onClick={() => navigate(-1)}>browser back</button>
    </>
  )
}

const renderCartAt = (entries: string[]) => {
  const store = makeStore({
    user: { data: me, status: "authenticated" },
    carts: { data: structuredClone(cart), pointers: { shopId: "s1", tableId: "t1" } },
  })
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Routes>
          <Route path="/shops/:shopId/tables/:tableId/cart" element={<Cart />} />
          <Route path="/shops/:shopId/tables/:tableId" element={<Marker text="table menu" />} />
          <Route path="/login" element={<Marker text="login page" />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
  return userEvent.setup()
}

const pay = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole("button", { name: /Check out/ }))
  await user.click(await screen.findByRole("button", { name: "Approve" }))
}

beforeEach(() => {
  server.use(
    http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart)),
    http.get(`${BASE}/shops/s1`, () =>
      HttpResponse.json({ _id: "s1", name: "Cafe", menu: [latte], tables: [{ _id: "t1", name: "Window", Qr_Url: "" }] })
    )
  )
})

describe("after paying", () => {
  it("keeps a contact-staff message, with its order id, until the diner closes it", async () => {
    const message = "Payment captured but could not be settled or refunded — please contact staff (order order1)"
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () => HttpResponse.json({ message }, { status: 500 }))
    )
    const user = renderCartAt(["/shops/s1/tables/t1/cart"])

    await pay(user)
    expect(await screen.findByText(message)).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 3500))

    expect(screen.getByText(message)).toBeInTheDocument()
  }, 10_000)

  it("keeps saying what happened while a closed message slides away, never \"Payment successful\"", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () => HttpResponse.json(cart, { status: 202 }))
    )
    const user = renderCartAt(["/shops/s1/tables/t1/cart"])
    await pay(user)
    const sheet = (await screen.findByText("Payment under review")).closest(".offcanvas") as HTMLElement

    await user.click(within(sheet).getByRole("button", { name: "Close" }))

    expect(screen.queryByText("Payment successful")).not.toBeInTheDocument()
    expect(screen.queryByText(/Your payment went through/)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("Payment under review")).not.toBeInTheDocument())
    expect(screen.queryByText("Payment successful")).not.toBeInTheDocument()
    // Closing a message that isn't a success stays on the cart.
    expect(screen.queryByText("table menu")).not.toBeInTheDocument()
  })

  it("shows a payment PayPal is reviewing as under review, not as failed, and keeps it", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () => HttpResponse.json(cart, { status: 202 }))
    )
    const user = renderCartAt(["/shops/s1/tables/t1/cart"])

    await pay(user)
    expect(await screen.findByText("Payment under review")).toBeInTheDocument()
    expect(screen.queryByText("Payment not completed")).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 3500))

    expect(screen.getByText("Payment under review")).toBeInTheDocument()
  }, 10_000)

  it("goes on to the table's menu, even when the page before the cart was the sign-in form", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () =>
        HttpResponse.json({ ...cart, status: "closed", split: [] })
      )
    )
    const user = renderCartAt(["/shops/s1/tables/t1", "/login", "/shops/s1/tables/t1/cart"])

    await pay(user)
    const sheet = (await screen.findByText("Payment successful")).closest(".offcanvas") as HTMLElement
    await user.click(within(sheet).getByRole("button", { name: "Close" }))

    expect(await screen.findByText("table menu")).toBeInTheDocument()
  })

  it("keeps a success up until the diner closes it", async () => {
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () =>
        HttpResponse.json({ ...cart, status: "closed", split: [] })
      )
    )
    const user = renderCartAt(["/shops/s1/tables/t1/cart"])

    await pay(user)
    expect(await screen.findByText("Payment successful")).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 3500))

    expect(screen.getByText("Your payment went through.")).toBeInTheDocument()
    expect(screen.queryByText("table menu")).not.toBeInTheDocument()
  }, 10_000)

  it("keeps a success up even when the paid-off cart then empties", async () => {
    let paid = false
    server.use(
      http.post(`${BASE}/carts/tables/t1/cart1/captureCheckout`, () => {
        paid = true
        return HttpResponse.json({ ...cart, status: "closed", split: [] })
      }),
      http.get(`${BASE}/carts/tables/t1`, () =>
        paid ? HttpResponse.json({ message: "Cart Not Found!" }, { status: 404 }) : HttpResponse.json(cart)
      )
    )
    const user = renderCartAt(["/shops/s1/tables/t1/cart"])

    await pay(user)
    expect(await screen.findByText("Payment successful")).toBeInTheDocument()
    // Coming back to the tab refetches the cart, which is gone once paid off.
    window.dispatchEvent(new Event("focus"))

    expect(await screen.findByText("No open orders")).toBeInTheDocument()
    expect(screen.getByText("Your payment went through.")).toBeInTheDocument()
  })
})

describe("the cart's Back button", () => {
  it("goes to the table's menu, not to the sign-in form the diner came through", async () => {
    server.use(
      http.get(`${BASE}/shops/s1`, () =>
        HttpResponse.json({ _id: "s1", name: "Cafe", menu: [latte], tables: [{ _id: "t1", name: "Window", Qr_Url: "" }] })
      )
    )
    const store = makeStore({
      user: { data: me, status: "authenticated" },
      carts: { data: structuredClone(cart), pointers: { shopId: "s1", tableId: "t1" } },
    })
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/shops/s1/tables/t1", "/login", "/shops/s1/tables/t1/cart"]} initialIndex={2}>
          <Routes>
            <Route path="/shops/:shopId/tables/:tableId/cart" element={<Cart />} />
            <Route path="/shops/:shopId/tables/:tableId" element={<Marker text="table menu" />} />
            <Route path="/login" element={<Marker text="login page" />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    )

    await userEvent.setup().click(screen.getByRole("button", { name: "Back" }))

    expect(await screen.findByText("table menu")).toBeInTheDocument()
  })
})

describe("PaymentFeedback", () => {
  it("renders the under-review variant", () => {
    render(
      <PaymentFeedback showFbk variant="pending" message="PayPal is still reviewing your payment." handleCloseFbk={() => {}} />
    )

    expect(screen.getByText("Payment under review")).toBeInTheDocument()
    expect(screen.getByText("PayPal is still reviewing your payment.")).toBeInTheDocument()
  })
})

describe("signing in on the way to a table's page", () => {
  it("takes the sign-in form's place in history, so Back doesn't return to it", async () => {
    rememberReturnTo("/shops/s1/tables/t1")
    server.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.json({})),
      http.get(`${BASE}/users/me`, () => HttpResponse.json(me))
    )
    const store = makeStore()
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={["/somewhere", "/login"]} initialIndex={1}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/shops/:shopId/tables/:tableId" element={<Marker text="table menu" />} />
            <Route path="/somewhere" element={<p>page before</p>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    )
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/email/i), "a@b.c")
    await user.type(screen.getByPlaceholderText(/password/i), "password123")
    await user.click(screen.getByRole("button", { name: "Log in" }))
    await user.click(await screen.findByRole("button", { name: "browser back" }))

    await waitFor(() => expect(screen.getByText("page before")).toBeInTheDocument())
  })
})
