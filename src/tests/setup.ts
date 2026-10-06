import "@testing-library/jest-dom/vitest"
import { afterAll, afterEach, beforeAll } from "vitest"
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
