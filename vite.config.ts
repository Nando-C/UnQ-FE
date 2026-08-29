/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix so unprefixed vars load too — DEV_PROXY_TARGET must never
  // reach the client bundle, so it deliberately has no VITE_ prefix.
  const env = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [react()],
    server: {
      port: 3000,
      // The app calls the BE on a relative /api path so its auth cookies are
      // first-party and Safari's ITP can't block them (see vercel.json, which
      // does the same rewrite in production). Dev mirrors it with this proxy.
      proxy: {
        "/api": {
          target: env.DEV_PROXY_TARGET || "http://localhost:3001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
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
  }
})
