# Security

UnQ handles sign-ins and payments, so a report about either is read first.

## Reporting a vulnerability

Report it privately through [GitHub's vulnerability reporting](https://github.com/Nando-C/UnQ-FE/security/advisories/new) on this repository, not as a public issue. Say what you found, where (a screen, a file, a flow), and how to reproduce it. You will get a reply within a week, and the fix ships as a patch release with a credit in the changelog unless you'd rather not be named. A finding in the API belongs in [UnQ-BE's policy](https://github.com/Nando-C/UnQ-BE/blob/main/SECURITY.md).

## Scope

- This client and its deployment at `un-q.vercel.app`.
- The demo runs in test mode. Use Stripe's test cards and PayPal's sandbox; never a real card. Don't test against other people's accounts or carts, and don't run load tests against the demo: its API sleeps on a free tier.
- Out of scope: the hosts themselves (Vercel, Render), the providers (Stripe, PayPal, Google), and anything in `docs/known-gaps.md` already listed as an accepted residual.

## Supported versions

The latest minor release gets fixes. The version is in `package.json`.
