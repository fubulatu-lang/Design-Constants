# Release discipline: keeping one version number

A version number is stated in several places that cannot import each other. They will
drift apart if the only thing stopping them is somebody remembering. So the check runs as
part of the build.

## Where the version lives

Map these onto the target app and drop the rows it does not have. Anything that states a
version and is *not* on the list is a source that will silently go stale.

| Where | Why it cannot just import the others |
|---|---|
| `package.json` `"version"` | A package-manager field. |
| The server's `APP_VERSION` constant | A different module system, read by the API and its health payload. |
| `src/lib/version.js` `CURRENT_VERSION` | What Settings displays. |
| `src/lib/changelog.js` — newest entry | What "What's New" shows. |
| `README.md` title | Docs, tied by convention to the newest release section. |
| A user-facing guide page stating the version it describes | Static HTML outside the build; it goes stale in a way nothing else does. |

## The check

`scripts/check-version.mjs` (copy-ready in `../assets/check-version.mjs`) is deliberately
regex-based over the raw file text: no build step, no dependency, and it behaves
identically from the package scripts, from CI, or run by hand.

Wire it into the build so a missed bump fails the build instead of shipping a version that
disagrees with itself:

```json
{
  "scripts": {
    "check:version": "node scripts/check-version.mjs",
    "build": "node scripts/check-version.mjs && <your build command>"
  }
}
```

It exits `1` and names the offending file in both failure modes — a version it could not
find (the file moved, or its format changed, so the script needs updating) and versions
that disagree (something was left behind in the bump).

There is also a softer, earlier catch: the dev-mode `console.warn` at the bottom of
`changelog.js` fires the moment `CHANGELOG[0].version` and `CURRENT_VERSION` disagree, so
anyone running the app locally sees the drift long before CI does. Keep both — the warning
is the fast feedback, the build check is the hard stop.

## The release checklist

Every user-visible change ships all of this, in one commit:

1. **Bump the version in every place the script checks.** Not just `package.json`.
2. **Prepend one entry to `CHANGELOG`** — `version`, `title`, `items`. See
   `writing-entries.md` for the house style; this is the part that is actually read.
3. **Add a matching section at the top of the README** (`## v2.4.0 — <the same title>`), at
   whatever length the change deserves. This is where technical detail, migration steps and
   deploy ordering live — the detail that deliberately stays out of the changelog.
4. **Revisit any hand-written guide or docs that replicate the app's screens.** Static
   pages outside the build are the ones that rot unnoticed.
5. **Run the build.** The check either passes or names the file you missed.

The one-commit rule is what makes the history readable afterwards. A version bump in one
commit and its changelog entry in another means `git log` can no longer answer "what
shipped in 2.4.0?" without cross-referencing.
