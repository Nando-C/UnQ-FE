/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/tests/setup.ts",
    // Component .css imports are no-ops in tests; skip processing them.
    css: false,
    // Deterministic env for the axios base URL and PayPal client id so
    // tests never depend on a developer's local .env.
    env: {
      VITE_BE_URL: "http://localhost:4000",
      VITE_PAYPAL_CLIENT_ID: "sb",
    },
  },
})
