import { describe, it, expect, vi } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import Register from "../components/Register/Register"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"

const fill = async (
  user: ReturnType<typeof import("@testing-library/user-event").default.setup>,
  {
    name = "Ada",
    surname = "Lovelace",
    email = "ada@b.com",
    password = "password123",
    verify = "password123",
  }: Partial<{
    name: string
    surname: string
    email: string
    password: string
    verify: string
  }> = {}
) => {
  if (name) await user.type(screen.getByPlaceholderText("First name"), name)
  if (surname) await user.type(screen.getByPlaceholderText("Last name"), surname)
  if (email) await user.type(screen.getByPlaceholderText("Enter email"), email)
  if (password) await user.type(screen.getByPlaceholderText("Password"), password)
  if (verify)
    await user.type(screen.getByPlaceholderText("Re-type Password"), verify)
}

describe("Register", () => {
  it("ties each field to its own label, with no id used twice", () => {
    renderWithProviders(<Register />)

    expect(screen.getByLabelText("First Name")).toHaveAttribute("placeholder", "First name")
    expect(screen.getByLabelText("Last Name")).toHaveAttribute("placeholder", "Last name")
    expect(screen.getByLabelText("Email address")).toHaveAttribute("placeholder", "Enter email")
    expect(screen.getByLabelText("Password")).toHaveAttribute("placeholder", "Password")
    expect(screen.getByLabelText("Re-type Password")).toHaveAttribute("placeholder", "Re-type Password")
    const ids = [...document.querySelectorAll("[id]")].map((el) => el.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("blocks submit and fires no request when passwords do not match", async () => {
    const registerSpy = vi.fn()
    server.use(
      http.post(`${BASE}/auth/register`, () => {
        registerSpy()
        return HttpResponse.json({})
      })
    )
    const { user } = renderWithProviders(<Register />)

    await fill(user, { password: "password123", verify: "different1" })
    await user.click(screen.getByRole("button", { name: "Sign up" }))

    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument()
    expect(registerSpy).not.toHaveBeenCalled()
  })

  it("blocks submit when the password is shorter than 8 characters", async () => {
    const registerSpy = vi.fn()
    server.use(
      http.post(`${BASE}/auth/register`, () => {
        registerSpy()
        return HttpResponse.json({})
      })
    )
    const { user } = renderWithProviders(<Register />)

    await fill(user, { password: "short", verify: "short" })
    await user.click(screen.getByRole("button", { name: "Sign up" }))

    expect(
      await screen.findByText("Password must be at least 8 characters")
    ).toBeInTheDocument()
    expect(registerSpy).not.toHaveBeenCalled()
  })

  it("surfaces a 409 as an already-registered alert", async () => {
    server.use(
      http.post(
        `${BASE}/auth/register`,
        () => new HttpResponse(null, { status: 409 })
      )
    )
    const { user } = renderWithProviders(<Register />)

    await fill(user)
    await user.click(screen.getByRole("button", { name: "Sign up" }))

    expect(await screen.findByText("Email already registered")).toBeInTheDocument()
  })

  it("posts exactly name, surname, email, password on the happy path", async () => {
    let body: Record<string, unknown> | undefined
    server.use(
      http.post(`${BASE}/auth/register`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ _id: "u1" })
      })
    )
    const { user } = renderWithProviders(<Register />)

    await fill(user)
    await user.click(screen.getByRole("button", { name: "Sign up" }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toEqual({
      name: "Ada",
      surname: "Lovelace",
      email: "ada@b.com",
      password: "password123",
    })
  })

  it("judges the retyped password only after it's left, and never shows green ticks", async () => {
    const { user } = renderWithProviders(<Register />)
    const again = screen.getByPlaceholderText("Re-type Password")

    await user.type(screen.getByPlaceholderText("Password"), "password123")
    await user.type(again, "pass")
    // Still typing: no verdict yet. (The message under the field shows only
    // while it's marked invalid; jsdom has no Bootstrap CSS to hide it.)
    expect(again).not.toHaveClass("is-invalid")

    await user.tab()
    expect(again).toHaveClass("is-invalid")
    expect(screen.getByText("Doesn't match the password above.")).toBeInTheDocument()

    await user.type(again, "word123")
    expect(again).not.toHaveClass("is-invalid")
    expect(document.querySelectorAll(".is-valid")).toHaveLength(0)
  })

  it("shows why it can't sign up above the Sign up button", async () => {
    const { user } = renderWithProviders(<Register />)

    await user.click(screen.getByRole("button", { name: "Sign up" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("All fields are required")
    const button = screen.getByRole("button", { name: "Sign up" })
    expect(alert.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("offers the way to log in, and Google", () => {
    renderWithProviders(<Register />)

    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login")
    expect(screen.getByRole("button", { name: "Sign up with Google" })).toHaveAttribute(
      "href",
      `${BASE}/auth/googleLogin`
    )
  })
})
