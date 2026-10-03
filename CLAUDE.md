# Buku Rekod

Vanilla-JS Firebase PWA (no build step) served from `public/`. See README.md
for structure and setup.

## Branches and releases

- `develop` is where work lands; `main` is the release branch.
- Features: branch off `develop` as `feature/<name>`, bump `APP_VERSION` in
  `public/js/version.js` in every user-facing PR (the service worker cache
  name comes from it), then open a PR into `develop`.
- Every `APP_VERSION` bump gets a matching entry at the top of `CHANGELOG` in
  `public/js/changelog.js`, written for the person using the app: what changed
  for them, no code. It is the What's new page and also the body of the
  "it's live" email, and the release workflow refuses a version without one.
- Every push to `develop` deploys the Firebase Hosting preview channel
  `develop` (`.github/workflows/preview.yml`).
- Release: `git merge --ff-only origin/develop` on `main`, push `main`, then
  `gh release create vX.Y.Z --target main --generate-notes`. The tag must be on
  `main` and match `APP_VERSION`; `.github/workflows/release.yml` checks both,
  deploys hosting + Firestore rules, and comments on the open `release-log`
  issue with that version's What's new entry.
- Roll back with `gh workflow run release.yml -f tag=<older tag>`.
- **Never run `firebase deploy` to live by hand.** Live only changes through
  the release workflow. If a release run fails on a permission, add the role it
  names to the `github-deploy` service account and rerun that run with
  `gh run rerun <id>`. Don't create a new tag.

## Checks

There are no tests. CI runs `node --check` on `public/js/*.js` and
`public/sw.js`, so run that locally before pushing.
