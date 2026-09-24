import { describe, it, expect, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import Item from "../components/Shops/Item/Item"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"

const makeShop = (overrides: Partial<Record<string, unknown>> = {}): IShop =>
  ({
    _id: "s1",
    name: "The Corner Cafe",
    cover: "",
    bio: "",
    open_times: "",
    phone: 123,
    web_URL: "",
    shopMg: [],
    tables: [],
    menu: [
      {
        _id: "m1",
        name: "Flat White",
        image: "https://example.test/flat-white.jpg",
        short_description: "Double shot, silky microfoam.",
        description: "Two ristretto shots poured through steamed whole milk.",
        price: 3.2,
        available: true,
        category: "drinks",
        ...overrides,
      },
    ],
  }) as unknown as IShop

const renderItem = (shop: IShop = makeShop()) =>
  renderWithProviders(<Item itemId="m1" shopId="s1" />, {
    preloadedState: { shops: { data: [shop], selected: shop, selectedMenu: null } },
  })

describe("Item availability switch", () => {
  it("exposes an accessible name and switch role", () => {
    renderItem()

    const toggle = screen.getByRole("switch", { name: "Flat White available" })
    expect(toggle).toBeChecked()
  })

  it("flips immediately and sends only the availability field", async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.put(`${BASE}/shops/s1/menu/m1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ _id: "m1" })
      })
    )
    const { user } = renderItem()
    const toggle = screen.getByRole("switch")

    await user.click(toggle)

    // Optimistic: unchecked without waiting on the request to resolve.
    expect(toggle).not.toBeChecked()
    await waitFor(() => expect(body).toBeDefined())
    expect(body).toEqual({ available: false })
  })

  it("does not refetch every shop on a toggle", async () => {
    const listSpy = vi.fn()
    server.use(
      http.put(`${BASE}/shops/s1/menu/m1`, () => HttpResponse.json({ _id: "m1" })),
      http.get(`${BASE}/shops/me`, () => {
        listSpy()
        return HttpResponse.json([])
      })
    )
    const { user } = renderItem()

    await user.click(screen.getByRole("switch"))

    await waitFor(() => expect(screen.getByRole("switch")).not.toBeChecked())
    expect(listSpy).not.toHaveBeenCalled()
  })

  it("rolls the switch back and reports the failure when the PUT fails", async () => {
    server.use(
      http.put(`${BASE}/shops/s1/menu/m1`, () => new HttpResponse(null, { status: 500 }))
    )
    const { user } = renderItem()
    const toggle = screen.getByRole("switch")

    await user.click(toggle)

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
    expect(toggle).toBeChecked()
  })
})

describe("Item row content", () => {
  it("hides the details disclosure when there is no description", () => {
    renderItem(makeShop({ description: "" }))

    expect(screen.queryByRole("button", { name: /details/i })).not.toBeInTheDocument()
  })

  it("reveals the full description behind the disclosure", async () => {
    const { user } = renderItem()
    const details = screen.getByRole("button", { name: "Details" })
    expect(details).toHaveAttribute("aria-expanded", "false")

    await user.click(details)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Hide details" })).toHaveAttribute(
        "aria-expanded",
        "true"
      )
    )
    expect(
      screen.getByText("Two ristretto shots poured through steamed whole milk.")
    ).toBeVisible()
  })

  it("renders no short-description line when the field is empty", () => {
    renderItem(makeShop({ short_description: "" }))

    expect(screen.queryByText(/microfoam/)).not.toBeInTheDocument()
  })

  it("formats the price to two decimals", () => {
    renderItem()

    expect(screen.getByText("£3.20")).toBeInTheDocument()
  })
})
