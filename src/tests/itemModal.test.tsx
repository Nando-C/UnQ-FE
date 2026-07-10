import { describe, it, expect, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import ItemModal from "../components/Shops/ItemModal/ItemModal"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"

const renderNewItemModal = () =>
  renderWithProviders(
    <ItemModal shopId="s1" show handleClose={() => {}} itemId="new" />
  )

describe("ItemModal", () => {
  it("offers exactly Food and Drinks as categories", () => {
    renderNewItemModal()

    const select = screen.getByRole("combobox")
    const options = within(select).getAllByRole("option") as HTMLOptionElement[]
    expect(options.map((o) => o.value)).toEqual(["food", "drinks"])
  })

  it("sends the decimal price and chosen category unchanged to the POST body", async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(`${BASE}/shops/s1/menu`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ _id: "m1" })
      }),
      // createItem refreshes the manager's shop list on success.
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([]))
    )
    const { user } = renderNewItemModal()

    await user.type(screen.getByPlaceholderText("Name"), "Latte")
    await user.type(screen.getByPlaceholderText("Price"), "4.5")
    await user.selectOptions(screen.getByRole("combobox"), "drinks")
    await user.click(screen.getByRole("button", { name: "Create Item" }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body?.price).toBe(4.5)
    expect(body?.category).toBe("drinks")
  })

  it("blocks a non-positive price and fires no request (S5 regression)", async () => {
    const createSpy = vi.fn()
    server.use(
      http.post(`${BASE}/shops/s1/menu`, () => {
        createSpy()
        return HttpResponse.json({ _id: "m1" })
      })
    )
    const { user } = renderNewItemModal()

    await user.type(screen.getByPlaceholderText("Name"), "Freebie")
    await user.type(screen.getByPlaceholderText("Price"), "0")
    await user.click(screen.getByRole("button", { name: "Create Item" }))

    expect(
      await screen.findByText("Price must be a positive number")
    ).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
  })
})
