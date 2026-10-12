import { describe, it, expect, beforeEach, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { AxiosError } from "axios"
import backend from "../backend/backend"
import ShopModal from "../components/Shops/ShopModal/ShopModal"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"

const shopWith = (over: Partial<IShop> = {}) =>
  ({ _id: "s1", name: "Cafe", menu: [], tables: [], shopMg: [], ...over }) as unknown as IShop

let sent: Record<string, unknown>[] = []

beforeEach(() => {
  sent = []
  server.use(
    http.put(`${BASE}/shops/s1`, async ({ request }) => {
      sent.push((await request.json()) as Record<string, unknown>)
      return HttpResponse.json({})
    }),
    http.get(`${BASE}/shops/me`, () => HttpResponse.json([])),
    // Saving reloads the shop.
    http.get(`${BASE}/shops/s1`, () => HttpResponse.json(shopWith()))
  )
})

const openEditor = (shop: IShop) =>
  renderWithProviders(<ShopModal show shopId="s1" handleClose={() => {}} />, {
    preloadedState: { shops: { data: [shop], selected: shop, selectedMenu: null } },
  })

describe("editing a shop's phone number", () => {
  it("leaves the field empty for a shop without one, and saves", async () => {
    const { user } = openEditor(shopWith())

    expect(screen.getByPlaceholderText("Phone Number")).toHaveValue("")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent).toHaveLength(1)
    expect(sent[0].phone).toBe("")
  })

  it("sends the number as typed, leading 0 and spaces included", async () => {
    const { user } = openEditor(shopWith())

    await user.type(screen.getByPlaceholderText("Phone Number"), " 0161 496 0000 ")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent[0].phone).toBe("0161 496 0000")
  })

  it("clears a number", async () => {
    const { user } = openEditor(shopWith({ phone: "07700 900123" }))
    const field = screen.getByPlaceholderText("Phone Number")
    expect(field).toHaveValue("07700 900123")

    await user.clear(field)
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent[0].phone).toBe("")
  })

  it("shows the BE's reason for a number it refuses", async () => {
    server.use(
      http.put(`${BASE}/shops/s1`, () =>
        HttpResponse.json(
          { message: "Validation failed", details: [{ path: "phone", message: "Phone number can only contain digits, spaces, dashes and brackets" }] },
          { status: 400 }
        )
      )
    )
    const { user } = openEditor(shopWith())

    await user.type(screen.getByPlaceholderText("Phone Number"), "call me")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText("Phone number can only contain digits, spaces, dashes and brackets")).toBeInTheDocument()
  })
})

describe("creating a shop", () => {
  it("doesn't make a second shop when the cover failed and Create is pressed again", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview")
    const calls: string[] = []
    let uploads = 0
    server.use(
      http.post(`${BASE}/shops`, () => {
        calls.push("create")
        return HttpResponse.json({ _id: "s2" })
      }),
      http.put(`${BASE}/shops/s2`, () => {
        calls.push("save")
        return HttpResponse.json({ _id: "s2" })
      })
    )
    // jsdom can't send a multipart body, so the upload is stubbed; the rest
    // goes to the mock server.
    const realPut = backend.put.bind(backend)
    vi.spyOn(backend, "put").mockImplementation(async (url, ...rest) => {
      if (!url.endsWith("/cover")) return realPut(url, ...rest)
      calls.push("cover")
      uploads += 1
      if (uploads === 1) throw new AxiosError("413", "ERR_BAD_REQUEST", undefined, undefined,
        { status: 413, data: { message: "File too large" } } as never)
      return { data: {} } as never
    })
    const { user, container } = renderWithProviders(<ShopModal show shopId="new" handleClose={() => {}} />)
    await user.type(screen.getByPlaceholderText("Name"), "Cafe")
    const input = container.ownerDocument.querySelector('input[type="file"]') as HTMLInputElement
    await user.upload(input, new File(["x"], "cover.png", { type: "image/png" }))

    await user.click(screen.getByRole("button", { name: "Create Shop" }))
    expect(
      await screen.findByText("The shop was created, but its cover wasn't saved: File too large")
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Create Shop" }))

    await waitFor(() => expect(calls).toEqual(["create", "cover", "save", "cover"]))
    vi.restoreAllMocks()
  })
})

describe("deleting a shop", () => {
  it("says what goes with it, and deletes only once confirmed", async () => {
    let deletes = 0
    server.use(
      http.delete(`${BASE}/shops/s1`, () => {
        deletes++
        return HttpResponse.json({})
      })
    )
    const shop = shopWith({
      menu: [{ _id: "m1" }, { _id: "m2" }] as IShop["menu"],
      tables: [{ _id: "t1", name: "1", Qr_Url: "" }] as IShop["tables"],
    })
    const { user } = openEditor(shop)

    await user.click(screen.getByRole("button", { name: "Delete shop" }))
    expect(
      screen.getByText("Delete Cafe? This also deletes its 2 menu items and 1 table, and their QR codes stop working. Its payment history goes too: refunds can then only be made from the payment provider.")
    ).toHaveFocus()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(deletes).toBe(0)
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Delete shop" }))
    await user.click(screen.getAllByRole("button", { name: "Delete shop" }).at(-1)!)
    await waitFor(() => expect(deletes).toBe(1))
  })
})

describe("the shop's time zone", () => {
  it("starts from the saved zone, the API's default when none, and saves the one picked", async () => {
    const { user } = openEditor(shopWith())
    const select = screen.getByRole("combobox", { name: "Time zone" })
    expect(select).toHaveValue("Europe/London")
    expect(screen.getByText("Sales are counted in the shop's own days: a day starts and ends on this clock.")).toBeInTheDocument()

    await user.selectOptions(select, "America/New_York")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent[0].timeZone).toBe("America/New_York")
  })

  it("shows a saved zone the browser's list leaves out, with UTC always offered", () => {
    openEditor(shopWith({ timeZone: "Asia/Calcutta" }))
    const select = screen.getByRole("combobox", { name: "Time zone" })
    expect(select).toHaveValue("Asia/Calcutta")
    expect(within(select).getByRole("option", { name: "UTC" })).toBeInTheDocument()
  })
})
