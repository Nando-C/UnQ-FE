import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"

// Matches the VITE_BE_URL injected by vite.config.ts's test.env block, so the
// axios instance in src/backend/backend.ts resolves every request here.
export const BASE = "http://localhost:4000"

// Default handlers keep an unauthenticated render quiet: "who am I" is a guest
// (401), the public shop list is empty, and the guest refresh probe 400s the
// way the real BE does — so the 401 interceptor's follow-up refresh resolves
// (to a rejection) instead of hitting an unhandled request.
export const handlers = [
  http.get(`${BASE}/users/me`, () => new HttpResponse(null, { status: 401 })),
  http.get(`${BASE}/shops/`, () => HttpResponse.json([])),
  http.post(`${BASE}/auth/refreshToken`, () => new HttpResponse(null, { status: 400 })),
]

export const server = setupServer(...handlers)
