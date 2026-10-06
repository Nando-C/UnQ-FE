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
    css: {
      preprocessorOptions: {
        scss: {
          // Bootstrap 5's SCSS uses Sass features deprecated for Dart Sass 3
          // (its own @import, global functions); nothing to fix on our side
          // until Bootstrap 6. Our own files still warn about everything but
          // @import, silenced for the one Bootstrap 5 requires in
          // styles/theme.scss (it doesn't support @use);
          // scripts/styleImports.test.mjs keeps @import to that file.
          quietDeps: true,
          silenceDeprecations: ["import"],
        },
        // The same for the indented syntax, should a .sass file appear.
        sass: { quietDeps: true, silenceDeprecations: ["import"] },
      },
    },
    build: {
      rolldownOptions: {
        output: {
          // The libraries every page uses in a chunk of their own: no chunk
          // over Vite's 500 kB warning, and returning visitors keep it cached
          // across deploys that don't change those libraries or what the app
          // uses of them (vercel.json caches the hashed .js and .css for a year). Only
          // those: a library only some pages use (the QR codes, PayPal) stays
          // with the code that imports it, so loading that code on demand
          // would leave it out of the first download.
          codeSplitting: {
            groups: [
              {
                name: "vendor",
                test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@reduxjs|redux|immer|reselect|react-redux|react-bootstrap|@restart|@popperjs|react-transition-group|dom-helpers|axios|react-icons)[\\/]/,
              },
            ],
          },
        },
      },
    },
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
      // Pinned (it's jsdom's default here): the page's origin. The BE below is
      // on it, as /api is in production, so requests are same-origin; msw
      // applies CORS to cross-origin ones.
      environmentOptions: { jsdom: { url: "http://localhost:3000/" } },
      globals: true,
      setupFiles: "./src/tests/setup.ts",
      // Component .css imports are no-ops in tests; skip processing them.
      css: false,
      // Deterministic env for the axios base URL and PayPal client id so
      // tests never depend on a developer's local .env.
      env: {
        VITE_BE_URL: "/api",
        VITE_PAYPAL_CLIENT_ID: "sb",
      },
    },
  }
})
