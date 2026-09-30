import { describe, it, expect, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import Login from "../components/Login/Login"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"

describe("Login", () => {
  it("shows a wrong-credentials alert on a 401", async () => {
    server.use(
      http.post(`${BASE}/auth/login`, () => new HttpResponse(null, { status: 401 }))
    )
    const { user } = renderWithProviders(<Login />)

    await user.type(screen.getByPlaceholderText("Enter email"), "a@b.com")
    await user.type(screen.getByPlaceholderText("Password"), "wrongpass")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    expect(await screen.findByText("Wrong email or password")).toBeInTheDocument()
  })

  it("dispatches the user fetch after a successful login", async () => {
    const meSpy = vi.fn()
    server.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.json({ ok: true })),
      http.get(`${BASE}/users/me`, () => {
        meSpy()
        return HttpResponse.json({
          _id: "u1",
          name: "Ada",
          surname: "Lovelace",
          email: "a@b.com",
          avatar: "",
          role: "customer",
        })
      })
    )
    const { user, store } = renderWithProviders(<Login />)

    await user.type(screen.getByPlaceholderText("Enter email"), "a@b.com")
    await user.type(screen.getByPlaceholderText("Password"), "correcthorse")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    await waitFor(() => expect(meSpy).toHaveBeenCalled())
    await waitFor(() =>
      expect(store.getState().user.status).toBe("authenticated")
    )
    expect(screen.queryByText("Wrong email or password")).not.toBeInTheDocument()
  })
})
