import { setupServer } from "msw/node"
import { http, HttpResponse } from "msw"

// The VITE_BE_URL injected by vite.config.ts's test.env block ("/api", as in
// production), which the axios instance in src/backend/backend.ts uses too.
// Relative: msw resolves it against the page's origin, as the browser does.
export const BASE = import.meta.env.VITE_BE_URL

// Default handlers keep an unauthenticated render quiet: "who am I" is a guest
// (401), the home page's shop list is empty, and the guest refresh probe 400s the
// way the real BE does — so the 401 interceptor's follow-up refresh resolves
// (to a rejection) instead of hitting an unhandled request.
export const handlers = [
  http.get(`${BASE}/users/me`, () => new HttpResponse(null, { status: 401 })),
  http.get(`${BASE}/shops/browse`, () => HttpResponse.json({ shops: [], next: null })),
  http.post(`${BASE}/auth/refreshToken`, () => new HttpResponse(null, { status: 400 })),
]

export const server = setupServer(...handlers)
