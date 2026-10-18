import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"

// The VITE_BE_URL injected by vite.config.ts's test.env block ("/api", as in
// production), which the axios instance in src/backend/backend.ts uses too.
// Relative: msw resolves it against the page's origin, as the browser does.
export const BASE = import.meta.env.VITE_BE_URL

// Default handlers keep an unauthenticated render quiet: "who am I" is a guest
// (401), the home page's shop list is empty, and the guest refresh probe 400s the
// way the real BE does — so the 401 interceptor's follow-up refresh resolves
// (to a rejection) instead of hitting an unhandled request. The account page
// asks for its devices: one, this one. Every signed-in account asks for its
// shops: none, as for a diner.
export const handlers = [
  http.get(`${BASE}/users/me`, () => new HttpResponse(null, { status: 401 })),
  http.get(`${BASE}/shops/me`, () => HttpResponse.json([])),
  http.get(`${BASE}/auth/sessions`, () =>
    HttpResponse.json([{ _id: "s1", createdAt: "2026-10-01T09:00:00.000Z", lastUsedAt: "2026-10-11T09:00:00.000Z", userAgent: "Mozilla/5.0 (iPhone) Safari/605.1", current: true }])
  ),
  http.get(`${BASE}/shops/browse`, () => HttpResponse.json({ shops: [], next: null })),
  http.post(`${BASE}/auth/refreshToken`, () => new HttpResponse(null, { status: 400 })),
]

export const server = setupServer(...handlers)
