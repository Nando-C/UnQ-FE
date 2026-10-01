import { describe, it, expect, vi } from "vitest"
import { screen, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import TableList from "../components/Tables/TableList/TableList"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShop } from "../typings/shop"

vi.mock("qr-code-styling", () => ({
  default: class {
    append() {}
    update() {}
  },
}))

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

const shopWith = (deletedTables: IShop["deletedTables"]) =>
  ({
    _id: "s1", name: "Cafe", menu: [],
    tables: [{ _id: "t1", name: "Window", Qr_Url: "https://x/t1" }],
    deletedTables,
  }) as unknown as IShop

const renderList = (shop: IShop) =>
  renderWithProviders(<TableList shopId="s1" />, {
    preloadedState: { shops: { all: [], data: [shop], selected: shop, selectedMenu: null } },
  })

describe("deleted tables on the manager's page", () => {
  it("lists those deleted in the last 24 hours, whose carts can still be opened", async () => {
    const opened: string[] = []
    server.use(
      http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])),
      http.get(`${BASE}/shops/s1/tables/:tableId/carts`, ({ params }) => {
        opened.push(String(params.tableId))
        return HttpResponse.json({ open: [], recentlyClosed: [] })
      })
    )
    const { user } = renderList(
      shopWith([
        { _id: "t9", name: "Patio", deletedAt: hoursAgo(1) },
        { _id: "t8", name: "Old", deletedAt: hoursAgo(30) },
      ])
    )

    const section = screen.getByRole("region", { name: "Deleted tables" })
    expect(within(section).queryByRole("button", { name: "View deleted table Old" })).not.toBeInTheDocument()
    await user.click(within(section).getByRole("button", { name: "View deleted table Patio" }))

    const sheet = await screen.findByRole("dialog")
    expect(within(sheet).getByText("Table Patio")).toBeInTheDocument()
    await within(sheet).findByText("This table was deleted: it takes no more orders.")
    expect(opened).toEqual(["t9"])
  })

  it("keeps listing an older one that still needs attention", () => {
    server.use(http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])))
    renderList(shopWith([{ _id: "t8", name: "Old", deletedAt: hoursAgo(72), needsAttention: true }]))

    const section = screen.getByRole("region", { name: "Deleted tables" })
    expect(within(section).getByRole("button", { name: "View deleted table Old" })).toBeInTheDocument()
  })

  it("shows nothing when no table was deleted lately", () => {
    server.use(http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])))
    renderList(shopWith([{ _id: "t8", name: "Old", deletedAt: hoursAgo(30) }]))

    expect(screen.queryByRole("region", { name: "Deleted tables" })).not.toBeInTheDocument()
  })

  it("shows nothing for a shop from before tables were kept", () => {
    server.use(http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])))
    renderList(shopWith(undefined))

    expect(screen.queryByRole("region", { name: "Deleted tables" })).not.toBeInTheDocument()
  })
})
