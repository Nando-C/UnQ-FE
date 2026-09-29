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

  it("blocks a price with a fraction of a penny and fires no request", async () => {
    const createSpy = vi.fn()
    server.use(
      http.post(`${BASE}/shops/s1/menu`, () => {
        createSpy()
        return HttpResponse.json({ _id: "m1" })
      })
    )
    const { user } = renderNewItemModal()

    await user.type(screen.getByPlaceholderText("Name"), "Latte")
    await user.type(screen.getByPlaceholderText("Price"), "1.006")
    await user.click(screen.getByRole("button", { name: "Create Item" }))

    expect(
      await screen.findByText("Price must be in whole pence (at most 2 decimals)")
    ).toBeInTheDocument()
    expect(createSpy).not.toHaveBeenCalled()
  })

  it("submits the edit form from Save Changes in the dialog's footer", async () => {
    // The button sits outside the <form> (so it stays in view while the body
    // scrolls) and reaches it through its form attribute.
    let body: Record<string, unknown> | undefined
    server.use(
      http.put(`${BASE}/shops/s1/menu/m1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ _id: "m1" })
      }),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([]))
    )
    const shop = {
      _id: "s1",
      name: "Shop",
      menu: [
        {
          _id: "m1",
          name: "Latte",
          image: "",
          short_description: "",
          description: "",
          price: 3,
          available: true,
          category: "drinks",
        },
      ],
      tables: [],
    }
    const { user } = renderWithProviders(
      <ItemModal shopId="s1" show handleClose={() => {}} itemId="m1" />,
      {
        preloadedState: {
          shops: { data: [shop], selected: null, selectedMenu: null },
        },
      } as unknown as Parameters<typeof renderWithProviders>[1]
    )

    const price = screen.getByPlaceholderText("Price")
    await user.clear(price)
    await user.type(price, "3.5")
    const save = screen.getByRole("button", { name: "Save Changes" })
    expect(save.closest("form")).toBeNull()
    await user.click(save)

    await waitFor(() => expect(body).toBeDefined())
    expect(body?.price).toBe(3.5)
    expect(body?.name).toBe("Latte")
  })

  it("shows Reset Image only after a photo is picked, and clears the pick", async () => {
    // jsdom has no object URLs; the preview only needs a string.
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:preview")
    const { user, container } = renderNewItemModal()

    expect(screen.queryByRole("button", { name: "Reset Image" })).toBeNull()

    const input = container.ownerDocument.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement
    await user.upload(input, new File(["x"], "latte.png", { type: "image/png" }))

    await user.click(await screen.findByRole("button", { name: "Reset Image" }))

    expect(screen.queryByRole("button", { name: "Reset Image" })).toBeNull()
    // Cleared, so choosing the same file again fires a change.
    expect(input.value).toBe("")
    createObjectURL.mockRestore()
  })
})
