import { describe, it, expect } from "vitest"
import { http, HttpResponse } from "msw"
import backend, { sessionUnknown } from "../backend/backend"
import { server, BASE } from "./server"

// Exercises the refresh-on-401 interceptor in src/backend/backend.ts.
describe("axios refresh interceptor", () => {
  it("refreshes on a 401 and replays the original request", async () => {
    let protectedCalls = 0
    let refreshCalls = 0
    server.use(
      http.get(`${BASE}/protected`, () => {
        protectedCalls += 1
        return protectedCalls === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json({ ok: true })
      }),
      http.post(`${BASE}/auth/refreshToken`, () => {
        refreshCalls += 1
        return HttpResponse.json({ ok: true })
      })
    )

    const res = await backend.get("/protected")

    expect(res.data).toEqual({ ok: true })
    expect(refreshCalls).toBe(1)
    expect(protectedCalls).toBe(2) // original 401 + one replay
  })

  it("rejects when the refresh call itself fails", async () => {
    server.use(
      http.get(`${BASE}/protected`, () => new HttpResponse(null, { status: 401 })),
      http.post(
        `${BASE}/auth/refreshToken`,
        () => new HttpResponse(null, { status: 401 })
      )
    )

    await expect(backend.get("/protected")).rejects.toMatchObject({
      response: { status: 401 },
    })
  })

  it("asks a read once more when the session is over, for a public route's guest view", async () => {
    let reads = 0
    server.use(
      // Like the table's cart: 401 for a stale login, the guest view without one
      // (the failed refresh cleared the cookies).
      http.get(`${BASE}/carts/tables/t1`, () => {
        reads += 1
        return reads === 1 ? new HttpResponse(null, { status: 401 }) : HttpResponse.json({ guest: true })
      }),
      http.post(`${BASE}/auth/refreshToken`, () => new HttpResponse(null, { status: 401 }))
    )

    const res = await backend.get("/carts/tables/t1")

    expect(res.data).toEqual({ guest: true })
    expect(reads).toBe(2)
  })

  it("sends a write again when another tab had just refreshed the session", async () => {
    let writes = 0
    server.use(
      http.post(`${BASE}/protected`, () => {
        writes += 1
        return writes === 1 ? new HttpResponse(null, { status: 401 }) : HttpResponse.json({ ok: true })
      }),
      http.post(`${BASE}/auth/refreshToken`, () =>
        HttpResponse.json({ message: "Invalid token", reason: "superseded" }, { status: 401 })
      )
    )

    await expect(backend.post("/protected")).resolves.toMatchObject({ data: { ok: true } })
    expect(writes).toBe(2)
  })

  it("waits for the other tab's new cookies before sending it again", async () => {
    // The winning tab's cookies land a little after this tab hears it lost.
    let refreshedAt = 0
    server.use(
      http.post(`${BASE}/protected`, () =>
        refreshedAt && Date.now() - refreshedAt > 150
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 })
      ),
      http.post(`${BASE}/auth/refreshToken`, () => {
        refreshedAt = Date.now()
        return HttpResponse.json({ message: "Invalid token", reason: "superseded" }, { status: 401 })
      })
    )

    await expect(backend.post("/protected")).resolves.toMatchObject({ data: { ok: true } })
  })

  it("sends a logout again too when another tab had just refreshed", async () => {
    // The winning tab's cookies land a little after this tab hears it lost.
    let refreshedAt = 0
    let logouts = 0
    server.use(
      http.get(`${BASE}/auth/logout`, () => {
        logouts += 1
        return refreshedAt && Date.now() - refreshedAt > 150
          ? HttpResponse.json({})
          : new HttpResponse(null, { status: 401 })
      }),
      http.post(`${BASE}/auth/refreshToken`, () => {
        refreshedAt = Date.now()
        return HttpResponse.json({ message: "Invalid token", reason: "superseded" }, { status: 401 })
      })
    )

    await expect(backend.get("/auth/logout")).resolves.toBeDefined()
    expect(logouts).toBe(2)
  })

  it("tries the refresh once more when the other tab's cookies land late", async () => {
    // They land after the wait: the resend still carries the spent token.
    let refreshes = 0
    let writes = 0
    server.use(
      http.post(`${BASE}/protected`, () => {
        writes += 1
        return refreshes >= 2 ? HttpResponse.json({ ok: true }) : new HttpResponse(null, { status: 401 })
      }),
      http.post(`${BASE}/auth/refreshToken`, () => {
        refreshes += 1
        return refreshes === 1
          ? HttpResponse.json({ message: "Invalid token", reason: "superseded" }, { status: 401 })
          : HttpResponse.json({})
      })
    )

    await expect(backend.post("/protected")).resolves.toMatchObject({ data: { ok: true } })
    expect(refreshes).toBe(2)
    expect(writes).toBe(3)
  })

  it("gives up after that one more try", async () => {
    let refreshes = 0
    server.use(
      http.post(`${BASE}/protected`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE}/auth/refreshToken`, () => {
        refreshes += 1
        return HttpResponse.json({ message: "Invalid token", reason: "superseded" }, { status: 401 })
      })
    )

    // Its own 401 (it wasn't carried out), marked: the session is still good.
    const err = await backend.post("/protected").catch((e: unknown) => e)
    expect(err).toMatchObject({ response: { status: 401 }, config: { url: "/protected" } })
    expect(sessionUnknown(err)).toBe(true)
    expect(refreshes).toBe(2)
  })

  it("keeps a write's own 401 (it wasn't carried out) when the refresh fails for a server fault", async () => {
    server.use(
      http.post(`${BASE}/protected`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE}/auth/refreshToken`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }))
    )

    const err = await backend.post("/protected").catch((e: unknown) => e)
    expect(err).toMatchObject({ response: { status: 401 } })
    expect(sessionUnknown(err)).toBe(true)
  })

  it("fails a read with its own 401, marked as not signed out, when the refresh itself fails", async () => {
    let reads = 0
    server.use(
      http.get(`${BASE}/protected`, () => {
        reads += 1
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${BASE}/auth/refreshToken`, () => HttpResponse.json({ message: "Generic Server Error" }, { status: 500 }))
    )

    const err = await backend.get("/protected").catch((e: unknown) => e)
    expect(err).toMatchObject({ response: { status: 401 } })
    expect(sessionUnknown(err)).toBe(true)
    expect(reads).toBe(1)
  })

  it.each([404, 429])("treats a refresh answered %i (not by the BE's session check) the same way", async (status) => {
    server.use(
      http.get(`${BASE}/protected`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE}/auth/refreshToken`, () => HttpResponse.json({ message: "x" }, { status }))
    )

    const err = await backend.get("/protected").catch((e: unknown) => e)
    expect(err).toMatchObject({ response: { status: 401 } })
    expect(sessionUnknown(err)).toBe(true)
  })

  it("doesn't mark a spent session (the refresh's 401) as unknown", async () => {
    server.use(
      http.post(`${BASE}/protected`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BASE}/auth/refreshToken`, () => HttpResponse.json({ message: "Invalid token" }, { status: 401 }))
    )

    const err = await backend.post("/protected").catch((e: unknown) => e)
    expect(sessionUnknown(err)).toBe(false)
  })

  it("doesn't refresh the session for a wrong password", async () => {
    let refreshes = 0
    server.use(
      http.post(`${BASE}/auth/login`, () => HttpResponse.json({ message: "Invalid credentials" }, { status: 401 })),
      http.post(`${BASE}/auth/refreshToken`, () => {
        refreshes += 1
        return HttpResponse.json({})
      })
    )

    await expect(backend.post("/auth/login")).rejects.toMatchObject({ response: { status: 401 } })
    expect(refreshes).toBe(0)
  })

  it("doesn't send a failed sign-in again", async () => {
    let logins = 0
    server.use(
      http.post(`${BASE}/auth/login`, () => {
        logins += 1
        return HttpResponse.json({ message: "Invalid credentials" }, { status: 401 })
      }),
      http.post(`${BASE}/auth/refreshToken`, () =>
        HttpResponse.json({ message: "Invalid token", reason: "superseded" }, { status: 401 })
      )
    )

    await expect(backend.post("/auth/login")).rejects.toMatchObject({ response: { status: 401 } })
    expect(logins).toBe(1)
  })

  it("doesn't send a write again when the session is over", async () => {
    let writes = 0
    server.use(
      http.post(`${BASE}/protected`, () => {
        writes += 1
        return new HttpResponse(null, { status: 401 })
      }),
      http.post(`${BASE}/auth/refreshToken`, () => new HttpResponse(null, { status: 401 }))
    )

    await expect(backend.post("/protected")).rejects.toMatchObject({ response: { status: 401 } })
    expect(writes).toBe(1)
  })
})
