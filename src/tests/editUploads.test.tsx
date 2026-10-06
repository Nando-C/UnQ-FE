import { describe, it, expect, vi, afterEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { AxiosError } from "axios"
import backend from "../backend/backend"
import ItemModal from "../components/Shops/ItemModal/ItemModal"
import ShopModal from "../components/Shops/ShopModal/ShopModal"
import AccountOffCanvas from "../components/Customers/AccountOffCanvas/AccountOffCanvas"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"
import type { IUser } from "../typings/user"

const tooLarge = () =>
  new AxiosError("413", "ERR_BAD_REQUEST", undefined, undefined, { status: 413, data: { message: "File too large" } } as never)

// jsdom can't send a multipart body, so the photo upload (a PUT to a URL ending
// in `suffix`) is stubbed to fail; every other request goes to the mock server.
const failUploadsTo = (suffix: string) => {
  const realPut = backend.put.bind(backend)
  vi.spyOn(backend, "put").mockImplementation(async (url, ...rest) => {
    if (url.endsWith(suffix)) throw tooLarge()
    return realPut(url, ...rest)
  })
}

const pickPhoto = async (user: { upload: (el: HTMLElement, f: File) => Promise<void> }) => {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  await user.upload(input, new File(["x"], "big.jpg", { type: "image/jpeg" }))
}

afterEach(() => vi.restoreAllMocks())

const latte = { _id: "m1", name: "Latte", image: "", short_description: "Hot", description: "", price: 3, available: true, category: "drinks" }
const shopWith = (over: Partial<IShop> = {}) =>
  ({ _id: "s1", name: "Cafe", cover: "", bio: "", open_times: "", phone: "", web_URL: "", shopMg: [], tables: [], menu: [latte], ...over }) as unknown as IShop

describe("saving an edit whose photo then fails to upload", () => {
  it("item: says the changes were saved, and the menu shows them", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview")
    let saved = shopWith()
    let listFetches = 0
    server.use(
      http.put(`${BASE}/shops/s1/menu/m1`, async ({ request }) => {
        const price = ((await request.json()) as { price: number }).price
        saved = shopWith({ menu: [{ ...latte, price }] } as Partial<IShop>)
        return HttpResponse.json({})
      }),
      http.get(`${BASE}/shops/me`, () => {
        listFetches++
        return HttpResponse.json([saved])
      })
    )
    failUploadsTo("/img")
    const { user, store } = renderWithProviders(<ItemModal shopId="s1" show handleClose={() => {}} itemId="m1" />, {
      preloadedState: { shops: { data: [shopWith()], selected: null, selectedMenu: null } },
    })

    await user.clear(screen.getByPlaceholderText("Price"))
    await user.type(screen.getByPlaceholderText("Price"), "3.5")
    await pickPhoto(user)
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const message = "The changes were saved, but the image wasn't: File too large"
    expect(await screen.findByText(message)).toBeInTheDocument()
    await waitFor(() => expect(store.getState().shops.data[0].menu[0].price).toBe(3.5))
    expect(listFetches).toBe(1)
    // Still there once the reloaded menu has reached the dialog.
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it("shop: says the changes were saved, and the shop page shows them", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview")
    let saved = shopWith()
    server.use(
      http.put(`${BASE}/shops/s1`, async ({ request }) => {
        saved = { ...saved, ...((await request.json()) as Partial<IShop>) }
        return HttpResponse.json(saved)
      }),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([saved])),
      http.get(`${BASE}/shops/s1`, () => HttpResponse.json(saved))
    )
    failUploadsTo("/cover")
    const { user, store } = renderWithProviders(<ShopModal show shopId="s1" handleClose={() => {}} />, {
      preloadedState: { shops: { data: [shopWith()], selected: shopWith(), selectedMenu: null } },
    })

    await user.clear(screen.getByPlaceholderText("Name"))
    await user.type(screen.getByPlaceholderText("Name"), "Corner Cafe")
    await pickPhoto(user)
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const message = "The changes were saved, but the cover wasn't: File too large"
    expect(await screen.findByText(message)).toBeInTheDocument()
    await waitFor(() => expect(store.getState().shops.selected?.name).toBe("Corner Cafe"))
    await waitFor(() => expect(store.getState().shops.data[0].name).toBe("Corner Cafe"))
    expect(screen.getByText(message)).toBeInTheDocument()
  })
})

describe("the account panel", () => {
  const ada: IUser = { _id: "u1", name: "Ada", surname: "Lovelace", email: "ada@example.com", avatar: "", role: "customer", hasPassword: true }

  it("says the details were saved when only the photo failed, and shows them", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview")
    let saved = ada
    server.use(
      http.put(`${BASE}/users/me`, async ({ request }) => {
        saved = { ...saved, ...((await request.json()) as Partial<IUser>) }
        return HttpResponse.json(saved)
      }),
      http.get(`${BASE}/users/me`, () => HttpResponse.json(saved))
    )
    failUploadsTo("/avatar")
    const { user, store } = renderWithProviders(<AccountOffCanvas show handleClose={() => {}} />, {
      preloadedState: { user: { data: ada, status: "authenticated" } },
    })

    await user.type(screen.getByPlaceholderText("Name"), "x")
    await pickPhoto(user)
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    const message = "Your details were saved, but the photo wasn't: File too large"
    expect(await screen.findByText(message)).toBeInTheDocument()
    await waitFor(() => expect(store.getState().user.data.name).toBe("Adax"))
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it("opens with the saved details, not edits abandoned last time", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview")
    const puts: string[] = []
    server.use(
      http.put(`${BASE}/users/me`, async ({ request }) => {
        puts.push(JSON.stringify(await request.json()))
        return HttpResponse.json(ada)
      }),
      http.get(`${BASE}/users/me`, () => HttpResponse.json(ada))
    )
    const uploads: string[] = []
    const realPut = backend.put.bind(backend)
    vi.spyOn(backend, "put").mockImplementation(async (url, ...rest) => {
      if (url.endsWith("/avatar")) {
        uploads.push(url)
        return { data: {} } as never
      }
      return realPut(url, ...rest)
    })
    const { user, rerender } = renderWithProviders(<AccountOffCanvas show handleClose={() => {}} />, {
      preloadedState: { user: { data: ada, status: "authenticated" } },
    })
    await user.clear(screen.getByPlaceholderText("Name"))
    await user.type(screen.getByPlaceholderText("Name"), "Abandoned")
    await pickPhoto(user)

    // Closed without saving, and opened again.
    rerender(<AccountOffCanvas show={false} handleClose={() => {}} />)
    rerender(<AccountOffCanvas show handleClose={() => {}} />)

    await waitFor(() => expect(screen.getByPlaceholderText("Name")).toHaveValue("Ada"))
    await user.click(screen.getByRole("button", { name: "Save Changes" }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(JSON.parse(puts[0]).name).toBe("Ada")
    expect(uploads).toHaveLength(0)
  })
})
