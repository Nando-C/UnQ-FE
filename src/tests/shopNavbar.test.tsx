import { describe, it, expect } from "vitest"
import { screen, within } from "@testing-library/react"
import ShopNavbar from "../components/Shops/ShopNavbar/ShopNavbar"
import { activeSection, hiddenEdges } from "../lib/sections"
import { renderWithProviders } from "./helpers"
import type { IShop } from "../typings/shop"

// A shop already selected in the store, as it is after a manager has opened
// one and come back to My Shops.
const shop = { _id: "s1", name: "First Shop", menu: [], tables: [] } as unknown as IShop

const renderAt = (route: string) =>
  renderWithProviders(<ShopNavbar />, {
    preloadedState: { shops: { all: [], data: [shop], selected: shop, selectedMenu: null } },
    route,
  })

describe("manager header", () => {
  it("on a shop's page, shows the breadcrumb to that shop and its section tabs", () => {
    renderAt("/shop/s1")

    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(within(crumbs).getByRole("link", { name: "My Shops" })).toHaveAttribute("href", "/")
    expect(within(crumbs).getByText("First Shop")).toHaveAttribute("aria-current", "page")

    const sections = screen.getByRole("navigation", { name: "Shop sections" })
    expect(within(sections).getByRole("link", { name: "Details" })).toHaveAttribute("href", "#shopDetails")
    expect(within(sections).getByRole("link", { name: "Menu" })).toHaveAttribute("href", "#shopMenu")
    expect(within(sections).getByRole("link", { name: "Tables" })).toHaveAttribute("href", "#tableList")
  })

  it("has no shop name or tabs on My Shops, even with a shop still selected", () => {
    renderAt("/")

    expect(screen.getByRole("link", { name: "My Shops" })).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: "Shop sections" })).not.toBeInTheDocument()
    expect(screen.queryByText("First Shop")).not.toBeInTheDocument()
  })

  it("shows no name while a different shop is still loading", () => {
    renderAt("/shop/s2") // the store still holds s1

    expect(screen.queryByText("First Shop")).not.toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Shop sections" })).toBeInTheDocument()
  })

  it("keeps the same links for My Shops and the account on both pages", () => {
    const links = (route: string) => {
      const { unmount } = renderAt(route)
      const names = [screen.getByRole("link", { name: "My Shops" }), screen.getByRole("link", { name: "Account" })]
        .map((a) => a.getAttribute("href"))
      unmount()
      return names
    }
    expect(links("/shop/s1")).toEqual(links("/"))
  })

  it("marks the tab you pick as the current section", async () => {
    const { user } = renderAt("/shop/s1")
    const sections = screen.getByRole("navigation", { name: "Shop sections" })

    // Nothing has scrolled, so the first section is current.
    expect(within(sections).getByRole("link", { name: "Details" })).toHaveAttribute("aria-current", "location")

    await user.click(within(sections).getByRole("link", { name: "Tables" }))

    expect(within(sections).getByRole("link", { name: "Tables" })).toHaveAttribute("aria-current", "location")
    expect(within(sections).getByRole("link", { name: "Details" })).not.toHaveAttribute("aria-current")
  })
})

describe("activeSection", () => {
  // Header 100px tall; sections' tops relative to the viewport.
  it("is the first section at the top of the page", () => {
    expect(activeSection([0, 900, 1800], 100, false)).toBe(0)
  })

  it("is the last section whose top has reached the header", () => {
    expect(activeSection([-800, 100, 1000], 100, false)).toBe(1)
    expect(activeSection([-800, 103, 1000], 100, false)).toBe(1) // rounding slack
    expect(activeSection([-800, 120, 1000], 100, false)).toBe(0)
  })

  it("is the last section at the bottom of the page, even if it can't reach the header", () => {
    expect(activeSection([-1600, -700, 400], 100, true)).toBe(2)
  })
})

describe("hiddenEdges", () => {
  // A 100px-wide strip holding 300px of text.
  it("fades only the end at the start", () => {
    expect(hiddenEdges(0, 300, 100)).toEqual({ start: false, end: true })
  })

  it("fades both edges in the middle", () => {
    expect(hiddenEdges(100, 300, 100)).toEqual({ start: true, end: true })
  })

  it("fades only the start at the end, allowing for sub-pixel positions", () => {
    expect(hiddenEdges(199.5, 300, 100)).toEqual({ start: true, end: false })
  })

  it("fades nothing when the text fits", () => {
    expect(hiddenEdges(0, 100, 100)).toEqual({ start: false, end: false })
  })
})
