import { describe, it, expect, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import ShopDetails from "../components/Shops/ShopDetails/ShopDetails"
import TableModal from "../components/Tables/TableModal/TableModal"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"

const latte = { _id: "m1", name: "Latte", image: "", short_description: "Hot", description: "", price: 3, available: true, category: "drinks" }
let saved: IShop

beforeEach(() => {
  saved = {
    _id: "s1", name: "Cafe", cover: "", bio: "", open_times: "", phone: "", web_URL: "",
    shopMg: [], menu: [latte], tables: [{ _id: "t1", name: "Window", Qr_Url: "" }],
  } as unknown as IShop
  server.use(
    http.get(`${BASE}/shops/s1`, () => HttpResponse.json(saved)),
    http.get(`${BASE}/shops/me`, () => HttpResponse.json([saved])),
    http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])),
    http.put(`${BASE}/shops/s1`, async ({ request }) => {
      saved = { ...saved, ...((await request.json()) as Partial<IShop>) }
      return HttpResponse.json(saved)
    })
  )
})

const openShopPage = () =>
  // As after a reload: nothing in the store yet.
  renderWithProviders(<ShopDetails />, { route: "/shop/s1", path: "/shop/:shopId" })

describe("the manager's shop page", () => {
  it("loads its menu and tables when opened directly (a reload or a bookmark)", async () => {
    openShopPage()

    expect(await screen.findByText("Latte")).toBeInTheDocument()
    expect(await screen.findByText("Window")).toBeInTheDocument()
  })

  it("shows the saved details once Edit details is saved", async () => {
    const { user } = openShopPage()
    await screen.findByText("Latte")
    // The shop's name heads the page.
    const detailsTitle = () => screen.getByRole("heading", { level: 1 })
    await waitFor(() => expect(detailsTitle()).toHaveTextContent("Cafe"))

    await user.click(screen.getByRole("button", { name: "Edit details" }))
    const name = await screen.findByPlaceholderText("Name")
    await waitFor(() => expect(name).toHaveValue("Cafe"))
    await user.clear(name)
    await user.type(name, "Corner Cafe")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    await waitFor(() => expect(detailsTitle()).toHaveTextContent("Corner Cafe"))
  })
})

describe("the Add Table dialog", () => {
  it("opens empty for the next table", async () => {
    const { user, rerender } = renderWithProviders(
      <TableModal shopId="s1" tableId="new" show handleClose={() => {}} />
    )
    await user.type(screen.getByPlaceholderText(/name/i), "Patio")

    rerender(<TableModal shopId="s1" tableId="new" show={false} handleClose={() => {}} />)
    rerender(<TableModal shopId="s1" tableId="new" show handleClose={() => {}} />)

    await waitFor(() => expect(screen.getByPlaceholderText(/name/i)).toHaveValue(""))
  })
})
