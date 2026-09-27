import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import MenuItem from "../components/Customers/MenuItem/MenuItem"
import Account from "../components/Customers/Account/Account"
import { renderWithProviders } from "./helpers"
import type { IShop } from "../typings/shop"

// Layout itself is checked by `npm run audit:responsive` in a real browser;
// these pin down the markup that makes it work on touch screens.

const me = {
  _id: "u1",
  name: "Touch",
  surname: "Screen",
  email: "u1@test.io",
  avatar: "",
  role: "customer",
}

describe("menu card on a touch screen", () => {
  it("renders Add in the action row, not as a hover overlay on the photo", () => {
    const shop = {
      _id: "s1",
      name: "Shop",
      tables: [],
      menu: [
        {
          _id: "m1",
          name: "Pancake",
          image: "",
          short_description: "",
          description: "",
          price: 5,
          available: true,
          category: "food",
        },
      ],
    } as unknown as IShop
    renderWithProviders(<MenuItem shopId="s1" itemId="m1" />, {
      preloadedState: {
        user: { data: me, status: "authenticated" },
        shops: { data: [], selected: shop, selectedMenu: null },
      },
      route: "/shops/s1/tables/t1",
      path: "/shops/:shopId/tables/:tableId",
    })

    const add = screen.getByRole("button", { name: "Add" })
    expect(add.closest(".image-col")).toBeNull()
    expect(add.closest(".actions")).not.toBeNull()
    // Same row as the quantity stepper.
    expect(add.closest(".actions")).toContainElement(
      screen.getByRole("button", { name: "Increase quantity" })
    )
  })
})

describe("account page", () => {
  it("has a named, visible-style edit button", () => {
    renderWithProviders(<Account />, {
      preloadedState: { user: { data: me, status: "authenticated" } },
    })

    const edit = screen.getByRole("button", { name: "Edit profile" })
    // A link-style button takes the primary colour; the old transparent
    // btn-primary drew a white pencil on the white card.
    expect(edit).toHaveClass("btn-link")
    expect(edit).not.toHaveClass("btn-primary")
  })
})
