---
name: changelog
description: Build an in-app "What's New" changelog — a version history dialog that pops up once per person after each release, plus a manual version link in Settings, plus a build-time check that stops the app's version number disagreeing with itself. Use this whenever the user mentions a changelog, release notes, "What's New", version history, an in-app update dialog, telling users what changed in a release, or a version-bump/release checklist — and also when they are setting up release discipline or asking how to keep a version number in sync across package.json, a server constant and the docs, even if they never say the word "changelog".
---

# In-app changelog ("What's New")

A changelog that lives inside the app, written for the people who use it rather than for
developers. It surfaces in exactly two places: automatically once per signed-in person
after a new version ships, and on demand from a version link at the bottom of Settings.

The full specification is `references/spec.md`. This file is the map: the build order,
the rules that are easy to get wrong, and how to adapt the reference code to a stack that
isn't React + Vite.

## Before you start

Read the target app first and answer these, because they change what you write:

- **What is the build tool?** The reference code uses `import.meta.env.DEV` (Vite). See
  *Adapting to the stack* below for the equivalent elsewhere.
- **Does the app render on a server?** `localStorage` does not exist there. In Next.js
  App Router the gate must live in a client component.
- **Who is "a person" here?** The gate keys on a user id. Find where the signed-in user
  comes from before writing the hook.
- **What is already stating a version?** Grep for the current version string. Every place
  it appears has to go into the version check, or it will drift.
- **What does the app call its dialog and chip components?** Use them. Do not introduce a
  second modal implementation for this one feature.

## Build order

1. `version.js` — the version constant, alone in its own module.
2. `changelog.js` — the array, plus the dev-mode drift warning.
3. `ChangelogModal` — the dialog.
4. `useChangelogGate` — the once-per-person-per-version gate.
5. Mount the gate in the app shell; add the Settings version link.
6. `check-version.mjs` and wire it into the build script.

Copy-ready files for every one of these are in `assets/`. They are React + Vite and are
meant to be adapted, not pasted blind.

## The rules that matter

These are the parts that get quietly broken later, so they are worth stating plainly.

**Keep the version constant in its own module.** Screens that display a version number
import `version.js`; only the dialog imports `changelog.js`. If you merge the two files,
or write `export const CURRENT_VERSION = CHANGELOG[0].version`, then every screen showing
a version number pulls the entire release history into its bundle. The array grows
forever, so this gets worse with every release. It is the single most important structural
rule in the feature, and it looks like harmless tidying to undo.

**Never edit or delete a shipped entry.** The array is the app's release history. Someone
who skipped four versions should be able to read all four. If an entry turned out to be
wrong, the next entry says so — you do not quietly rewrite the old one.

**Key the gate on the user id, not the device.** Devices get shared. A device-wide key
shows the popup to whoever opens the app next and skips it for the person who has not seen
it yet.

**Compare the stored version by equality, not by ordering.** The stored value is the
version that was seen; anything other than the current version means show it. No version
parsing, and a rollback still behaves sensibly rather than suppressing the dialog forever.

**Swallow storage failures in both directions.** In a private window, reads and writes can
throw. The feature should degrade to "shows once each session" rather than taking the app
down over a changelog.

**The gate governs only the automatic popup.** The Settings link always opens the dialog,
whatever has been seen.

**Mount the gate once, in the app shell.** Inside a page it remounts on every navigation
and the dialog reappears.

**Namespace the id if two apps share an origin.** An admin tool alongside the main app
should pass `admin:${id}`. Without it, two unrelated people whose ids collide across
separate databases dismiss the popup for each other.

**Let the version check run in the build, not as a script someone remembers.** The version
is stated in files that cannot import each other, so it will drift if the only thing
stopping it is discipline. `npm run build` should fail and name the file that was missed.

## Adapting to the stack

The rules above are stack-neutral. Three things in the reference code are not:

| Reference code (React + Vite) | What to change it to |
|---|---|
| `import.meta.env.DEV` | Next.js / webpack / CRA: `process.env.NODE_ENV !== 'production'`. Vue + Vite keeps `import.meta.env.DEV`. |
| `localStorage` direct access | Next.js App Router: mark the gate `'use client'` and read storage inside `useEffect`, never during render. React Native: `AsyncStorage`, which is async — make the effect handle a promise. |
| JSX + hooks | Vue: a composable returning refs, with the same gate semantics. Svelte: a store. The logic is about twenty lines either way; the semantics above are what must survive the port. |

If the app has no dialog component, build the changelog dialog against the accessibility
requirements in the `design-foundations` skill
(`../design-foundations/references/modal-accessibility.md`) rather than inventing the
plumbing here. Generated ids matter especially: two dialogs can be on screen at once, and
a hard-coded `aria-labelledby` breaks that silently.

## Writing the entries

This is the part that decides whether the feature is any good. The array is read by the
people who use the app, not by developers — titles are sentences about what is now true,
data questions get answered explicitly, and technical detail belongs in the README instead.

`references/writing-entries.md` is the house style, written to stand alone: read it when
composing a release entry, without needing the rest of the spec.

## Shipping a release

Every user-visible change ships the version bump, the changelog entry, the README section
and the docs pass in one commit. `references/release-discipline.md` has the checklist and
the version-check script in full.

## Reference files

| File | Read it when |
|---|---|
| `references/spec.md` | Building the feature — the complete original specification, including the acceptance checklist. |
| `references/writing-entries.md` | Writing a changelog entry for a release. Stands alone. |
| `references/release-discipline.md` | Bumping a version, or wiring up the build-time check. |
| `assets/` | Copy-ready React + Vite implementations of all five files. |
