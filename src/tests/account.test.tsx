import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import AccountOffCanvas from "../components/Customers/AccountOffCanvas/AccountOffCanvas"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import type { IUser } from "../typings/user"

const ada: IUser = {
  _id: "u1", name: "Ada", surname: "Lovelace", email: "ada@example.com", avatar: "", role: "customer", hasPassword: true,
}

const renderAccount = (me: IUser = ada) => {
  const sent: unknown[] = []
  server.use(
    http.put(`${BASE}/users/me`, async ({ request }) => {
      sent.push(await request.json())
      return HttpResponse.json(me)
    }),
    http.get(`${BASE}/users/me`, () => HttpResponse.json(me))
  )
  const utils = renderWithProviders(<AccountOffCanvas show handleClose={() => {}} />, {
    preloadedState: { user: { data: me, status: "authenticated" } },
  })
  return { ...utils, sent }
}

describe("editing the account", () => {
  it("saves the name without asking for the password", async () => {
    const { user, sent } = renderAccount()

    await user.type(screen.getByPlaceholderText("Name"), "x")
    expect(screen.queryByPlaceholderText("Current password")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent).toEqual([{ name: "Adax", surname: "Lovelace", email: "ada@example.com" }])
  })

  it("asks for the current password to change the email, and sends it", async () => {
    const { user, sent } = renderAccount()

    await user.clear(screen.getByPlaceholderText("Email"))
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com")
    await user.type(screen.getByPlaceholderText("Current password"), "password123")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent).toEqual([
      { name: "Ada", surname: "Lovelace", email: "new@example.com", currentPassword: "password123" },
    ])
  })

  it("shows the BE's answer to a wrong current password", async () => {
    const { user } = renderAccount()
    server.use(
      http.put(`${BASE}/users/me`, () =>
        HttpResponse.json({ message: "Your current password is incorrect" }, { status: 403 })
      )
    )

    await user.clear(screen.getByPlaceholderText("Email"))
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com")
    await user.type(screen.getByPlaceholderText("Current password"), "nope")
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(await screen.findByText("Your current password is incorrect")).toBeInTheDocument()
  })

  it("doesn't ask a Google-only account for a password", async () => {
    const { user, sent } = renderAccount({ ...ada, hasPassword: false })

    await user.clear(screen.getByPlaceholderText("Email"))
    await user.type(screen.getByPlaceholderText("Email"), "new@example.com")
    expect(screen.queryByPlaceholderText("Current password")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save Changes" }))

    expect(sent).toEqual([{ name: "Ada", surname: "Lovelace", email: "new@example.com" }])
  })
})
