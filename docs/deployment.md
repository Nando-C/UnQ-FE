# Deployment

Where the client runs, what it needs from its hosts and from the API's, and the order a release goes out in. Read from `vercel.json`, `vite.config.ts`, `.env.example`, `.github/workflows/` and `CHANGELOG.md`. The API's side is in [UnQ-BE's operations.md](https://github.com/Nando-C/UnQ-BE/blob/main/docs/operations.md).

## Where it runs

| Piece | Host | Notes |
|---|---|---|
| This app | Vercel, `https://un-q.vercel.app` | framework Vite, build `npm run build`, output `dist/` (not Create React App's `build/`: a wrong setting serves an empty site) |
| `/api/*` | the same origin, rewritten by Vercel to the API on Render | `vercel.json`; the destination omits `/api`, so the API serves its documented paths unchanged |
| Every other path | `index.html`, by a second rewrite in `vercel.json` | A project with its own rewrites gets no single-page fallback from Vercel's Vite preset: without this line a deep link (a table's QR URL, `/login`) is a 404 |
| The API | Render, `https://unq-be.onrender.com` | free tier: the first request after idling can take about a minute |

`vercel.json` also caches the hashed `assets/*.js` and `*.css` for a year, immutable; the vendor chunk changes only when a library does.

## Configuration

| Variable | Value | Why |
|---|---|---|
| `VITE_BE_URL` | `/api` | the path the app calls the API on, relative, so the API's cookies are first-party (Safari drops them otherwise). Set to the API's absolute URL, the rewrite is never used and Safari users can't sign in. |
| `VITE_PAYPAL_CLIENT_ID` | the PayPal app's client id | falls back to PayPal's shared `sb` sandbox id if unset |
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` / `pk_live_…` of the same account as the API's secret key | unset, the checkout offers PayPal only |
| `DEV_PROXY_TARGET` | `http://localhost:3001` (default) | where the dev server forwards `/api`; no `VITE_` prefix on purpose, so it never reaches the bundle |

Everything a `VITE_` variable holds is public: it is in the bundle anyone can read.

### On the API's host

Three settings there make this app work, and a wrong one fails silently:

- `PUBLIC_API_URL` must be the **proxied prefix**, `https://un-q.vercel.app/api`: the API builds Google's OAuth callback from it, and the callback must land on this origin, where the cookies it sets are readable. Pointing it at the API's own host sets the cookies out of reach, and Google sign-in fails in every browser.
- The same URL plus `/auth/googleRedirect` must be an authorised redirect URI in the Google Cloud Console.
- `FRONTEND_PROD_URL` (and `FRONTEND_DEV_URL` locally) must be this origin: the API's CORS whitelist is load-bearing even behind the proxy, since a browser's same-origin POST still sends `Origin`.

For Apple Pay and Google Pay, the exact domain must be registered under Stripe's **Payment method domains**; the wallets only appear on an HTTPS page of a registered domain.

## Releasing

The two repositories release together with their own [Semantic Versioning](https://semver.org/) numbers. This app at `x.y.*` needs the API at `x.y.0` or later: the shared MINOR says which pair belong together, patches are independent, and the MAJOR changes only when a release needs a change on a host or a new API major (2.0.0 was one: `VITE_BE_URL`, the output directory, the Stripe key). A release goes out on a branch `release/x.y.0` that one pull request merges, after the API's own release is live:

1. **Settle the docs.** Every claim in `README.md` and `docs/` that changed since the last tag is re-read against the code (`git diff $(git describe --tags --abbrev=0)..main --stat -- README.md docs/` lists the pages), and [known-gaps.md](./known-gaps.md) says what the release still leaves open, its roadmap paragraph included. A screen that changed has its screenshot retaken with `npm run shots -- --env=<file>`, which drives the live demo as its two accounts (the file names the demo passwords and is never committed). To show the release before it ships, `--base=<url>` points it at the branch served locally with `/api` proxied to the live API; the proxy must then send the live client's `Origin`, or the API's CORS check refuses the sign-in. The Try it sections here and on the [product page](https://github.com/Nando-C/UnQ) describe the live demo: a flow or a screen that changed changes their sentences too.
2. **Refresh the API contract fixture** from the API release this one pairs with (`npm run contract:refresh -- <url|file>`, see [testing.md](./testing.md)); the contract test checks the fixture's MAJOR.MINOR is this app's.
3. **Close the changelog.** The Unreleased section becomes `[x.y.0] - <date>`, opened by a paragraph that says what changed, which API release it needs and what the host needs (deploy notes first when a host setting changes); an empty Unreleased section goes above it.
4. **Bump the version**: `npm version minor --no-git-tag-version` (or `patch`), and the README's version badge to match; a test fails when they differ.
5. **Run the gates**: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, and `npm run audit:responsive` when layout changed. Open the pull request; CI runs them again (`npm ci`, lint, tests, build on Node 24).
6. **Merge once the API answers the new version** at `GET /health`; Vercel builds `main`. Tag what is deployed, `git tag -a vx.y.0 -m "UnQ front end x.y.0"` on `main`, and push the tag.
7. **Check the live site**: a deep link renders (`/shops/<id>/tables/<id>`, not a 404: the fallback rewrite is in place); sign in on Safari with tracking prevention on; Google sign-in completes; a test card pays (`4242 4242 4242 4242`; `4000 0025 0000 3155` asks for a bank check; `4000 0000 0000 0002` is declined); Apple Pay or Google Pay shows on a registered domain; the README's Try it reads true against what the demo shows. Then close the roadmap issues the pair ships, each with a line on what shipped where.

## Local development

`npm run dev` on `:3000`, proxying `/api` to `DEV_PROXY_TARGET`. Anything behind sign-in needs the API running (its own `PUBLIC_API_URL` then `http://localhost:3000/api`, registered with Google for the OAuth round trip). Copy `.env.example` to `.env`; the tests ignore `.env` (`vite.config.ts` pins their environment). Wallets can be tried locally through an HTTPS tunnel whose domain is registered with Stripe.
