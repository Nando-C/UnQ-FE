<!-- What changes for someone using UnQ, and why. If this closes an issue, say "Closes #n". -->

## Checklist

- [ ] `CHANGELOG.md` has an entry under Unreleased, or nothing anyone using the app can see has changed (label `no-docs`).
- [ ] Every rule this change touches is updated on the page that describes it, in `docs/` or `README.md`, in this same change; a wording the UI shows and a doc quotes changes in both.
- [ ] A screen that changed has its screenshot retaken (`npm run shots`) and the sentences that describe it re-read; a new API call is in the contract test's list.
- [ ] The issue or `docs/known-gaps.md` item this closes is updated here, and the issue closes with this pull request, not by hand.
