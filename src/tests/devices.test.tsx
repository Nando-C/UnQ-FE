import { describe, it, expect } from "vitest"
import { screen, waitFor, within } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import Devices from "../components/Customers/Account/Devices"
import { renderWithProviders } from "./helpers"
import { server, BASE } from "./server"
import { describeDevice } from "../lib/devices"
import type { ISession } from "../typings/user"

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const MAC_CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
const WINDOWS_EDGE = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"
const ANDROID_FIREFOX = "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0"

const phone: ISession = { _id: "se1", createdAt: "2026-09-20T18:12:00.000Z", lastUsedAt: "2026-10-11T08:40:00.000Z", userAgent: IPHONE, current: true }
const laptop: ISession = { _id: "se2", createdAt: "2026-10-02T09:05:00.000Z", lastUsedAt: "2026-10-10T17:30:00.000Z", userAgent: MAC_CHROME, current: false }
const unknown: ISession = { _id: "se3", createdAt: "2026-10-08T12:00:00.000Z", lastUsedAt: "2026-10-08T12:00:00.000Z", current: false }

const renderDevices = (sessions: ISession[] = [phone, laptop, unknown]) => {
  const deleted: string[] = []
  server.use(
    http.get(`${BASE}/auth/sessions`, () => HttpResponse.json(sessions)),
    http.delete(`${BASE}/auth/sessions/:id`, ({ params }) => {
      deleted.push(String(params.id))
      return new HttpResponse(null, { status: 204 })
    })
  )
  return { ...renderWithProviders(<Devices />), deleted }
}

describe("naming a device from its User-Agent", () => {
  it("says the browser and the kind of device, telling the look-alikes apart", () => {
    expect(describeDevice(IPHONE)).toBe("Safari on iPhone")
    expect(describeDevice(MAC_CHROME)).toBe("Chrome on Mac")
    expect(describeDevice(WINDOWS_EDGE)).toBe("Edge on Windows")
    expect(describeDevice(ANDROID_FIREFOX)).toBe("Firefox on Android")
  })

  it("gives what it can, or 'Unknown device'", () => {
    expect(describeDevice("curl/8.4.0")).toBe("Unknown device")
    expect(describeDevice("Mozilla/5.0 (X11; Linux x86_64) Gecko")).toBe("Linux")
    expect(describeDevice(undefined)).toBe("Unknown device")
  })
})

describe("the account's devices", () => {
  it("lists them with their dates, marks this one, and offers to sign the others out", async () => {
    renderDevices()

    const items = await screen.findAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent("Safari on iPhone")
    expect(items[0]).toHaveTextContent("This device")
    expect(items[0]).toHaveTextContent("Signed in 20 Sept 2026 · last used 11 Oct 2026")
    expect(within(items[0]).queryByRole("button")).not.toBeInTheDocument()
    expect(within(items[1]).getByRole("button", { name: "Sign out Chrome on Mac" })).toBeInTheDocument()
    expect(items[2]).toHaveTextContent("Unknown device")
    expect(within(items[2]).getByRole("button", { name: "Sign out Unknown device" })).toBeInTheDocument()
  })

  it("signs one device out and drops it from the list", async () => {
    const { user, deleted } = renderDevices()

    await user.click(await screen.findByRole("button", { name: "Sign out Chrome on Mac" }))

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2))
    expect(deleted).toEqual(["se2"])
    expect(screen.queryByText("Chrome on Mac")).not.toBeInTheDocument()
    expect(screen.getByText("Safari on iPhone")).toBeInTheDocument()
  })

  it("keeps the device and says so when signing it out fails", async () => {
    const { user } = renderDevices()
    server.use(http.delete(`${BASE}/auth/sessions/:id`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 })))

    await user.click(await screen.findByRole("button", { name: "Sign out Chrome on Mac" }))

    expect(await screen.findByText("Couldn't sign that device out. Check your connection and try again.")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    expect(screen.getByRole("button", { name: "Sign out Chrome on Mac" })).toBeEnabled()
  })

  it("drops a device the API no longer knows (signed out meanwhile) without complaint", async () => {
    const { user } = renderDevices()
    server.use(http.delete(`${BASE}/auth/sessions/:id`, () => HttpResponse.json({ message: "Session not found" }, { status: 404 })))

    await user.click(await screen.findByRole("button", { name: "Sign out Chrome on Mac" }))

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("says when the list couldn't be loaded, and retries", async () => {
    let failures = 1
    server.use(
      http.get(`${BASE}/auth/sessions`, () =>
        failures-- > 0 ? HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }) : HttpResponse.json([phone])
      )
    )
    const { user } = renderWithProviders(<Devices />)

    expect(await screen.findByText("Couldn't load your devices.")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Safari on iPhone")).toBeInTheDocument()
    expect(screen.queryByText("Couldn't load your devices.")).not.toBeInTheDocument()
  })
})
