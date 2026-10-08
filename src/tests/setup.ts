import "@testing-library/jest-dom/vitest"
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import { server } from "./server"

// jsdom is missing a few browser APIs that react-bootstrap's overlays touch.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}

window.ResizeObserver =
  window.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

window.scrollTo = window.scrollTo || (() => {})

// No Stripe key unless a suite sets one: `.env`'s VITE_* variables reach the
// tests, and with a key the checkout sheet lists its methods instead of
// showing PayPal's button, so a suite would pass or fail by the developer's
// `.env`. The card suites set it themselves.
beforeEach(() => {
  vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "")
})
afterEach(() => {
  vi.unstubAllEnvs()
})

// Fail loudly on any request the tests didn't explicitly stub: msw refuses it
// (the app may catch that), and the test it happened in fails too.
const unhandled: string[] = []
beforeAll(() =>
  server.listen({
    onUnhandledFrame({ frame, defaults }) {
      const { request } = frame.data as { request?: Request }
      unhandled.push(request ? `${request.method} ${request.url}` : String(frame.protocol))
      defaults.error()
    },
  })
)
afterEach(() => {
  server.resetHandlers()
  cleanup()
  expect(unhandled.splice(0), "requests no handler answered").toEqual([])
})
afterAll(() => server.close())
