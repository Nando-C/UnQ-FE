import { describe, it, expect } from "vitest"
import { http, HttpResponse } from "msw"
import backend from "../backend/backend"
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
