import { describe, it, expect, vi } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
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
    preloadedState: { shops: { data: [shop], selected: shop, selectedMenu: null } },
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
        { _id: "t9", name: "Patio", deletedAt: hoursAgo(1), recentCartsUntil: hoursAgo(-20) },
        { _id: "t8", name: "Old", deletedAt: hoursAgo(30), recentCartsUntil: hoursAgo(1) },
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

  it("reloads the manager's shops after an action in a deleted table's sheet", async () => {
    let shopFetches = 0
    const cart = { _id: "c9", tableId: "t9", status: "open", items: [], split: [], payments: [], refunds: [] }
    server.use(
      http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])),
      http.get(`${BASE}/shops/s1/tables/t9/carts`, () => HttpResponse.json({ open: [cart], recentlyClosed: [] })),
      http.post(`${BASE}/shops/s1/tables/t9/carts/c9/close`, () => HttpResponse.json({ deleted: true, dropped: [] })),
      http.get(`${BASE}/shops/me`, () => {
        shopFetches++
        return HttpResponse.json([shopWith([{ _id: "t9", name: "Patio", deletedAt: hoursAgo(1) }])])
      })
    )
    const { user } = renderList(shopWith([{ _id: "t9", name: "Patio", deletedAt: hoursAgo(1), needsAttention: true }]))

    await user.click(screen.getByRole("button", { name: "View deleted table Patio" }))
    const sheet = await screen.findByRole("dialog")
    await user.click(await within(sheet).findByRole("button", { name: "Close table" }))
    const question = sheet.querySelector(".modal-footer") as HTMLElement
    await user.click(within(question).getByRole("button", { name: "Close table" }))

    await waitFor(() => expect(shopFetches).toBe(1))
  })

  it("keeps a deleted table's sheet open when it stops needing attention", async () => {
    const cart = { _id: "c8", tableId: "t8", status: "open", items: [], split: [], payments: [], refunds: [] }
    server.use(
      http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])),
      http.get(`${BASE}/shops/s1/tables/t8/carts`, () => HttpResponse.json({ open: [cart], recentlyClosed: [] })),
      http.post(`${BASE}/shops/s1/tables/t8/carts/c8/close`, () => HttpResponse.json({ deleted: true, dropped: [] })),
      // Closed, the table no longer needs attention, and it was deleted days ago.
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([shopWith([{ _id: "t8", name: "Old", deletedAt: hoursAgo(72) }])]))
    )
    const { user, store } = renderList(shopWith([{ _id: "t8", name: "Old", deletedAt: hoursAgo(72), needsAttention: true }]))

    await user.click(screen.getByRole("button", { name: "View deleted table Old" }))
    const sheet = await screen.findByRole("dialog")
    await user.click(await within(sheet).findByRole("button", { name: "Close table" }))
    await user.click(within(sheet.querySelector(".modal-footer") as HTMLElement).getByRole("button", { name: "Close table" }))
    await waitFor(() => expect(store.getState().shops.data[0].deletedTables?.[0].needsAttention).toBeUndefined())

    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())

    // Still listed for this visit, so focus has its button to go back to.
    const button = screen.getByRole("button", { name: "View deleted table Old" })
    await waitFor(() => expect(button).toHaveFocus())
  })

  it("keeps listing an older one that still needs attention", () => {
    server.use(http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])))
    renderList(shopWith([{ _id: "t8", name: "Old", deletedAt: hoursAgo(72), needsAttention: true }]))

    const section = screen.getByRole("region", { name: "Deleted tables" })
    expect(within(section).getByRole("button", { name: "View deleted table Old" })).toBeInTheDocument()
  })

  it("doesn't list one deleted lately whose sheet would be empty", () => {
    server.use(http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])))
    renderList(shopWith([{ _id: "t7", name: "Bare", deletedAt: hoursAgo(1) }]))

    expect(screen.queryByRole("region", { name: "Deleted tables" })).not.toBeInTheDocument()
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
