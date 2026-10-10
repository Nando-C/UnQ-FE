import { describe, it, expect, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import AllShopsList from "../components/Customers/AllShopsList/AllShopsList"
import NavigationBar from "../components/Customers/NavigationBar/NavigationBar"
import { SHOPS_FRESH_MS } from "../redux/slices/browseSlice"
import { gate, makeStore, renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IShopPage, IShopSummary } from "../typings/shop"

const shop = (name: string): IShopSummary => ({ _id: `id-${name}`, name, cover: "", bio: `${name}'s bio` })

// Answers GET /shops/browse with `answer(query)`, and keeps each query asked.
type Answer = IShopPage | Response
const browse = (answer: (query: URLSearchParams) => Answer | Promise<Answer>) => {
  const asked: URLSearchParams[] = []
  server.use(
    http.get(`${BASE}/shops/browse`, async ({ request }) => {
      const query = new URL(request.url).searchParams
      asked.push(query)
      const body = await answer(query)
      return body instanceof Response ? body : HttpResponse.json(body)
    })
  )
  return asked
}
const asText = (asked: URLSearchParams[]) => asked.map((query) => query.toString())
const serverDown = () => HttpResponse.json({ message: "down" }, { status: 500 })
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

const shopNames = () => screen.queryAllByRole("heading", { level: 2 }).map((h) => h.textContent)

describe("the home page's shops", () => {
  it("loads 20 at a time, and shows more until the last page", async () => {
    const asked = browse((query) =>
      query.get("cursor") === "id-B"
        ? { shops: [shop("C")], next: null }
        : { shops: [shop("A"), shop("B")], next: "id-B" }
    )
    const { user } = renderWithProviders(<AllShopsList />)

    expect(await screen.findByText("A")).toBeInTheDocument()
    expect(shopNames()).toEqual(["A", "B"])
    await user.click(screen.getByRole("button", { name: "Show more" }))

    expect(await screen.findByText("C")).toBeInTheDocument()
    expect(shopNames()).toEqual(["A", "B", "C"])
    expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument()
    expect(asText(asked)).toEqual(["limit=20", "cursor=id-B&limit=20"])
  })

  it("searches on the server once typing pauses, and pages the results", async () => {
    const asked = browse((query) => {
      if (!query.get("q")) return { shops: [shop("A"), shop("Lemon Tree")], next: null }
      return query.get("cursor")
        ? { shops: [shop("Lemonade Bar")], next: null }
        : { shops: [shop("Lemon Tree")], next: "id-Lemon Tree" }
    })
    const { user } = renderWithProviders(<AllShopsList />)
    await screen.findByText("A")

    await user.type(screen.getByLabelText("Search Shop"), "  lemon ")
    await waitFor(() => expect(shopNames()).toEqual(["Lemon Tree"]))
    await user.click(screen.getByRole("button", { name: "Show more" }))

    expect(await screen.findByText("Lemonade Bar")).toBeInTheDocument()
    // One search for the whole word, trimmed; the next page of that search.
    expect(asText(asked)).toEqual(["limit=20", "q=lemon&limit=20", "q=lemon&cursor=id-Lemon+Tree&limit=20"])
  })

  it("ignores a search's answer that arrives after a later search's", async () => {
    const slow = gate()
    const asked = browse(async (query) => {
      if (query.get("q") === "lemon") {
        await slow.opened
        return { shops: [shop("Lemon Tree")], next: null }
      }
      if (query.get("q") === "tea") return { shops: [shop("Tea Room")], next: null }
      return { shops: [shop("A")], next: null }
    })
    const { user, store } = renderWithProviders(<AllShopsList />)
    await screen.findByText("A")
    const search = screen.getByLabelText("Search Shop")

    await user.type(search, "lemon")
    // Shown while the search runs: the shops already in hand.
    await waitFor(() => expect(asText(asked)).toContain("q=lemon&limit=20"))
    expect(shopNames()).toEqual(["A"])
    await user.clear(search)
    await user.type(search, "tea")
    expect(await screen.findByText("Tea Room")).toBeInTheDocument()

    // Until the late answer has reached the store (each answer is dispatched).
    let dispatched = 0
    const stop = store.subscribe(() => dispatched++)
    slow.open()
    await waitFor(() => expect(dispatched).toBeGreaterThan(0))
    stop()
    expect(shopNames()).toEqual(["Tea Room"])
  })

  it("offers to try again when a search fails, rather than another search's shops", async () => {
    let down = true
    browse((query) => {
      if (query.get("q") !== "tea") return { shops: [shop("A")], next: null }
      return down ? serverDown() : { shops: [shop("Tea Room")], next: null }
    })
    const { user } = renderWithProviders(<AllShopsList />)
    await screen.findByText("A")

    await user.type(screen.getByLabelText("Search Shop"), "tea")
    await screen.findByText("Couldn't load the shops.")
    expect(shopNames()).toEqual([])

    down = false
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Tea Room")).toBeInTheDocument()
  })

  it("keeps a search's shops shown when refreshing them fails, with a way to try again", async () => {
    let down = false
    browse((query) =>
      down ? serverDown() : { shops: [shop(query.get("q") ? "Tea Room" : "A")], next: null }
    )
    const { user } = renderWithProviders(<AllShopsList />)
    await screen.findByText("A")

    // A failed search, then back to every shop, which fails too.
    down = true
    const search = screen.getByLabelText("Search Shop")
    await user.type(search, "tea")
    await screen.findByText("Couldn't load the shops.")
    await user.clear(search)
    await waitFor(() => expect(shopNames()).toEqual(["A"]))
    expect(screen.getByText("Couldn't load the shops.")).toBeInTheDocument()

    down = false
    await user.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(screen.queryByText("Couldn't load the shops.")).not.toBeInTheDocument())
    expect(shopNames()).toEqual(["A"])
  })

  it("keeps the shops shown when the next page fails, and tries it again", async () => {
    let down = true
    browse((query) => {
      if (!query.get("cursor")) return { shops: [shop("A")], next: "id-A" }
      return down ? serverDown() : { shops: [shop("B")], next: null }
    })
    const { user } = renderWithProviders(<AllShopsList />)
    await user.click(await screen.findByRole("button", { name: "Show more" }))

    expect(await screen.findByText("Couldn't load more shops.")).toBeInTheDocument()
    expect(shopNames()).toEqual(["A"])

    down = false
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("B")).toBeInTheDocument()
    expect(screen.queryByText("Couldn't load more shops.")).not.toBeInTheDocument()
  })

  it("back on the page, keeps the search and the shops loaded, without asking again", async () => {
    const asked = browse((query) =>
      query.get("cursor")
        ? { shops: [shop("Tea House")], next: null }
        : { shops: [shop(query.get("q") ? "Tea Room" : "A")], next: query.get("q") ? "id-Tea Room" : null }
    )
    const store = makeStore()
    const first = renderWithProviders(<AllShopsList />, { store })
    await screen.findByText("A")
    await first.user.type(screen.getByLabelText("Search Shop"), "tea")
    await first.user.click(await screen.findByRole("button", { name: "Show more" }))
    await screen.findByText("Tea House")
    first.unmount()

    renderWithProviders(<AllShopsList />, { store })
    await pause(50)
    expect(screen.getByLabelText("Search Shop")).toHaveValue("tea")
    expect(shopNames()).toEqual(["Tea Room", "Tea House"])
    expect(asked).toHaveLength(3)
  })

  it("back on the page after a minute, loads the shops again, showing the old ones meanwhile", async () => {
    const reload = gate()
    let calls = 0
    browse(async () => {
      calls += 1
      if (calls === 1) return { shops: [shop("A")], next: null }
      await reload.opened
      return { shops: [shop("A"), shop("New")], next: null }
    })
    const store = makeStore()
    const first = renderWithProviders(<AllShopsList />, { store })
    await screen.findByText("A")
    first.unmount()

    const now = Date.now()
    const clock = vi.spyOn(Date, "now").mockReturnValue(now + SHOPS_FRESH_MS + 1)
    try {
      renderWithProviders(<AllShopsList />, { store })
      await waitFor(() => expect(calls).toBe(2))
      expect(shopNames()).toEqual(["A"])
      reload.open()
      expect(await screen.findByText("New")).toBeInTheDocument()
    } finally {
      clock.mockRestore()
    }
  })

  it("hides Show more while another search loads, so it can't page the old one", async () => {
    const slow = gate()
    browse(async (query) => {
      if (!query.get("q")) return { shops: [shop("A")], next: "id-A" }
      await slow.opened
      return { shops: [shop("Tea Room")], next: "id-Tea Room" }
    })
    const { user } = renderWithProviders(<AllShopsList />)
    await screen.findByRole("button", { name: "Show more" })

    await user.type(screen.getByLabelText("Search Shop"), "tea")
    await waitFor(() => expect(screen.queryByRole("button", { name: "Show more" })).not.toBeInTheDocument())
    expect(shopNames()).toEqual(["A"])

    slow.open()
    expect(await screen.findByRole("button", { name: "Show more" })).toBeEnabled()
    expect(shopNames()).toEqual(["Tea Room"])
  })

  it("tries again the search that failed", async () => {
    let down = true
    const asked = browse((query) => {
      if (query.get("q") === "tea" && down) return serverDown()
      return { shops: [shop(query.get("q") ? "Tea Room" : "A")], next: null }
    })
    const { user } = renderWithProviders(<AllShopsList />)
    await screen.findByText("A")
    await user.type(screen.getByLabelText("Search Shop"), "tea")
    await screen.findByText("Couldn't load the shops.")

    down = false
    await user.type(screen.getByLabelText("Search Shop"), "p")
    await user.click(screen.getByRole("button", { name: "Try again" }))

    await waitFor(() => expect(asText(asked)).toContain("q=teap&limit=20"))
    expect(asText(asked).filter((query) => query === "q=tea&limit=20")).toHaveLength(2)
  })

  it("isn't loaded by the navigation bar", async () => {
    const asked = browse(() => ({ shops: [], next: null }))
    const { store } = renderWithProviders(<NavigationBar />)

    await pause(50)
    expect(asked).toHaveLength(0)
    expect(store.getState().browse.status).toBeUndefined()
  })
})
