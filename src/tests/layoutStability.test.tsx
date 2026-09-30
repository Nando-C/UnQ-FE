import { describe, it, expect, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { Provider } from "react-redux"
import { useRef } from "react"
import { http, HttpResponse } from "msw"
import App from "../App"
import CartListItems from "../components/Customers/CartListItems/CartListItems"
import TableMenu from "../components/Customers/TableMenu/TableMenu"
import TableList from "../components/Tables/TableList/TableList"
import { usePublishedHeight } from "../lib/usePublishedHeight"
import { makeStore, renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { ICart } from "../typings/cart"
import type { IMenu } from "../typings/menu"
import type { IShop } from "../typings/shop"

const menu = (id: string, available = true): IMenu => ({
  _id: id, name: `item-${id}`, image: "", short_description: "", description: "", price: 3, available, category: "food",
})
const me = { _id: "u1", name: "A", surname: "B", email: "a@b.c", avatar: "", role: "customer" }

// Holds a request until the test lets it through.
const gate = () => {
  let open!: () => void
  const opened = new Promise<void>((r) => (open = r))
  return { open, opened }
}

describe("a cart row's counter", () => {
  // m1: 3 units, none picked. m2: 2 units, I hold both. m3: 2 units, another
  // diner holds both. m4: sold out.
  const cart: ICart = {
    _id: "c1", userId: "u1", tableId: "t1", status: "open",
    items: [
      { _id: "i1", menuId: menu("m1"), qty: 3, qtyPayed: 0 },
      { _id: "i2", menuId: menu("m2"), qty: 2, qtyPayed: 0 },
      { _id: "i3", menuId: menu("m3"), qty: 2, qtyPayed: 0 },
      { _id: "i4", menuId: menu("m4", false), qty: 1, qtyPayed: 0 },
    ],
    split: [
      { _id: "s1", userId: "u1", menuId: menu("m2"), qty: 2, splitStatus: "open" },
      { _id: "s2", userId: "u2", menuId: menu("m3"), qty: 2, splitStatus: "open" },
    ],
  }
  const row = (name: string) => screen.getByText(name).closest(".CartItem") as HTMLElement

  it("says how many units are left to pick, and when none are", () => {
    server.use(http.get(`${BASE}/carts/tables/t1`, () => HttpResponse.json(cart)))
    renderWithProviders(<CartListItems handleShowFbk={() => {}} />, {
      preloadedState: {
        user: { data: me, status: "authenticated" },
        carts: { data: structuredClone(cart), pointers: { shopId: "s1", tableId: "t1" } },
      },
      route: "/shops/s1/tables/t1/cart",
      path: "/shops/:shopId/tables/:tableId/cart",
    })

    expect(within(row("item-m1")).getByText("3 left to pick")).toBeInTheDocument()
    expect(within(row("item-m2")).getByText("All picked")).toBeInTheDocument()
    expect(within(row("item-m3")).getByText("All claimed by others")).toBeInTheDocument()
    // A sold-out row has its own note instead.
    expect(row("item-m4").querySelector(".cart-meta")).toBeNull()
    expect(screen.queryByText(/in cart/)).not.toBeInTheDocument()
  })
})

describe("the menu's photo", () => {
  it("keeps its space from the start, before the shop and its photo arrive", async () => {
    const answer = gate()
    const shop = { _id: "s1", name: "Cafe", cover: "https://img.example/cafe.jpg", menu: [menu("m1")], tables: [] }
    server.use(
      http.get(`${BASE}/shops/s1`, async () => {
        await answer.opened
        return HttpResponse.json(shop)
      })
    )
    const { container } = renderWithProviders(<TableMenu />, {
      route: "/shops/s1/tables/t1",
      path: "/shops/:shopId/tables/:tableId",
    })

    const hero = container.querySelector(".shop-hero")
    expect(hero).not.toBeNull()
    expect(hero!.querySelector("img")).toBeNull()

    answer.open()
    expect(await screen.findByText("Cafe")).toBeInTheDocument()
    // The same box, now holding the photo (decorative: the name is right below).
    expect(container.querySelector(".shop-hero")).toBe(hero)
    expect(hero!.querySelector("img")).toHaveAttribute("alt", "")
  })
})

describe("the Tables section", () => {
  it("waits for the manager's shops, so nothing below the menu is pushed down", () => {
    const { container } = renderWithProviders(<TableList shopId="s1" />, {
      preloadedState: { shops: { all: [], data: [], selected: null, selectedMenu: null, dataStatus: "loading" } },
    })

    expect(container).toBeEmptyDOMElement()
  })

  it("shows once they have loaded", () => {
    server.use(http.get(`${BASE}/shops/s1/tables/status`, () => HttpResponse.json([])))
    const shop = { _id: "s1", name: "Cafe", menu: [], tables: [] } as unknown as IShop
    renderWithProviders(<TableList shopId="s1" />, {
      preloadedState: { shops: { all: [], data: [shop], selected: null, selectedMenu: null, dataStatus: "ready" } },
    })

    expect(screen.getByRole("heading", { name: "Tables" })).toBeInTheDocument()
  })
})

describe("published heights", () => {
  const original = window.ResizeObserver
  afterEach(() => {
    window.ResizeObserver = original
  })

  it("publish an element's height as a CSS variable, and remove it when it goes", () => {
    let report = () => {}
    window.ResizeObserver = class {
      constructor(cb: () => void) {
        report = cb
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
    const Bar = () => {
      const ref = useRef<HTMLDivElement>(null)
      usePublishedHeight(ref, "--test-h")
      return <div ref={ref} />
    }
    const { container, unmount } = render(<Bar />)
    Object.defineProperty(container.firstChild, "offsetHeight", { value: 62 })

    report()
    expect(document.documentElement.style.getPropertyValue("--test-h")).toBe("62px")
    unmount()
    expect(document.documentElement.style.getPropertyValue("--test-h")).toBe("")
  })
})

describe("the app for a manager", () => {
  it("marks itself, so pages allow for the header before it is measured", async () => {
    const manager = { ...me, role: "shopMg" }
    server.use(
      http.get(`${BASE}/users/me`, () => HttpResponse.json(manager)),
      http.get(`${BASE}/shops/me`, () => HttpResponse.json([]))
    )
    window.history.pushState({}, "", "/")
    const { container } = render(
      <Provider store={makeStore({ user: { data: manager, status: "authenticated" } })}>
        <App />
      </Provider>
    )

    expect(container.querySelector(".App")).toHaveClass("is-manager")
    expect(await screen.findByRole("heading", { name: "My Shops" })).toBeInTheDocument()
  })
})
