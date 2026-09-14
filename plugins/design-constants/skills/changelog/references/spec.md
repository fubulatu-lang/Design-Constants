# How to Build the "What's New" Changelog

A complete specification of an in-app changelog: the data, the dialog, the once-per-version
popup, the manual entry points, and the release discipline that keeps a version number from
disagreeing with itself. Hand this file to a coding agent working on any app and it should
be able to build the feature end to end.

Nothing here is tied to a particular product. `<App>` and `<app>` stand for your app's name
and its storage prefix — replace them throughout. No colours are specified; use the app's
own tokens.

---

## Contents

- [1. What the feature is](#1-what-the-feature-is)
- [2. The four files](#2-the-four-files)
- [3. `version.js`](#3-versionjs)
- [4. `changelog.js` — the data](#4-changelogjs--the-data)
- [5. `ChangelogModal.jsx` — the dialog](#5-changelogmodaljsx--the-dialog)
- [6. `useChangelogGate.js` — the automatic popup](#6-usechangeloggatejs--the-automatic-popup)
- [7. The manual entry points](#7-the-manual-entry-points)
- [8. Release discipline: keeping one version number](#8-release-discipline-keeping-one-version-number)
- [9. How to write the entries — this is the part that makes it good](#9-how-to-write-the-entries--this-is-the-part-that-makes-it-good)
- [10. Acceptance checklist](#10-acceptance-checklist)
- [11. File manifest](#11-file-manifest)

---

## 1. What the feature is

A changelog that lives inside the app, written for the people who use it rather than for
developers. It surfaces in exactly two ways:

1. **Automatically**, once per signed-in person, the first time they open the app after a
   new version ships. It appears as a dialog titled "What's New".
2. **On demand**, by tapping the version number at the bottom of the Settings screen,
   which reads `<App> v2.4.0 — What's New`.

The same dialog serves both. The entries are a single hand-maintained array, newest first,
and adding one is a required step of every release.

---

## 2. The four files

| File | Role | Size |
|---|---|---|
| `src/lib/version.js` | Exports `CURRENT_VERSION` and nothing else. | one line of code |
| `src/lib/changelog.js` | Exports the `CHANGELOG` array — every entry ever written. | large, grows forever |
| `src/components/ChangelogModal.jsx` | Renders the array in a dialog. | ~20 lines |
| `src/hooks/useChangelogGate.js` | Decides whether to show the dialog automatically. | ~25 lines |

**The split between the first two is the whole performance story and must be kept.**
Screens that only need to *display* the version number import `version.js`. The
several-hundred-line array of static text loads only when somebody actually opens the
dialog. If you merge them, or derive `CURRENT_VERSION` from `CHANGELOG[0].version`, every
screen showing the version pulls the entire release history into its bundle.

---

## 3. `version.js`

```js
/**
 * Just the current version number, in its own tiny module so pages that only need to
 * display it don't pull in the full changelog history. Must match CHANGELOG[0].version
 * — a dev-mode console warning there catches it if the two drift apart.
 */
export const CURRENT_VERSION = '2.4.0';
```

---

## 4. `changelog.js` — the data

Newest entry first. Each entry is `{ version, title, items }`, where `items` is an array of
plain strings.

```js
import { CURRENT_VERSION } from './version';

export const CHANGELOG = [
  {
    version: '2.4.0',
    title: 'A search that finds people by the name they actually use',
    items: [
      'Searching now matches a middle name, a shortened first name and a maiden name, so someone filed as "Elizabeth" is found by typing "Beth".',
      'Nothing about how records are stored has changed, and no record was edited by this — only the way they are looked up.',
    ],
  },
  {
    version: '2.3.1',
    title: 'The setting that would not save',
    items: [
      'Choosing a default for new entries failed with an error on every account created before this month. The setting itself was right; the place it saves into was never added to older accounts.',
      'Nothing was lost or wrongly recorded by this. Until the fix reaches you, the app behaves exactly as it always did, which is what the setting defaults to anyway.',
    ],
  },
  // … every previous entry, in descending version order, forever
];

if (import.meta.env.DEV && CHANGELOG[0].version !== CURRENT_VERSION) {
  // eslint-disable-next-line no-console
  console.warn(
    `CHANGELOG[0].version (${CHANGELOG[0].version}) doesn't match CURRENT_VERSION (${CURRENT_VERSION}) — update whichever one is stale.`
  );
}
```

The dev-only warning at the bottom is what makes the two-file split safe: the moment the
array and the constant disagree, anyone running the app locally sees it. (The build-time
check in §8 is the hard stop.)

Entries are never edited after they ship and never deleted. The array is the app's release
history, and someone who skipped four versions should be able to read all four.

---

## 5. `ChangelogModal.jsx` — the dialog

A dialog titled **"What's New"** (an icon such as `history_edu` beside it) containing the
whole array. Each entry renders as:

- a **chip** with the version, `v2.4.0` — the newest entry's chip uses the primary
  variant, all older ones the neutral variant, so "which one is new" is answered without
  reading;
- the entry **title** beside the chip, slightly bolder and smaller than a heading;
- the **items** as a plain bulleted list in the app's muted note style;
- a **divider** between entries, but not after the last one.

```jsx
import { Modal, Chip } from './ui';
import { CHANGELOG } from '../lib/changelog';

export function ChangelogModal({ onClose }) {
  return (
    <Modal open onClose={onClose} title="What's New" icon="history_edu">
      {CHANGELOG.map((entry, i) => (
        <div key={entry.version} style={{ marginBottom: i < CHANGELOG.length - 1 ? 18 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Chip variant={i === 0 ? 'primary' : 'neutral'}>v{entry.version}</Chip>
            <span style={{ fontWeight: 600, fontSize: '.88rem' }}>{entry.title}</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {entry.items.map((item, j) => <li key={j} className="note">{item}</li>)}
          </ul>
          {i < CHANGELOG.length - 1 && (
            <hr style={{ border: 'none', borderTop: '1px solid var(--outline-variant)', marginTop: 18 }} />
          )}
        </div>
      ))}
    </Modal>
  );
}
```

The `Modal` must do the usual dialog plumbing: `role="dialog"`, `aria-modal`,
`aria-labelledby` pointing at a **generated** id (two dialogs can be on screen at once, so
a hard-coded id silently breaks), Escape to close, overlay click to close, focus moved into
the dialog on open and returned to the trigger on close, and `body` scroll locked while
open.

The dialog scrolls; the history is long by design, and the newest entry is at the top.

---

## 6. `useChangelogGate.js` — the automatic popup

Shows the dialog once per **person**, per **version**.

```js
import { useEffect, useState } from 'react';
import { CURRENT_VERSION } from '../lib/version';

function storageKey(userId) {
  return `<app>.changelogSeen.${userId}`;
}

export function useChangelogGate(userId) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let seenVersion = null;
    try {
      seenVersion = localStorage.getItem(storageKey(userId));
    } catch {
      /* storage unavailable — fall through and just don't nag every load */
    }
    setShow(seenVersion !== CURRENT_VERSION);
  }, [userId]);

  function dismiss() {
    setShow(false);
    if (!userId) return;
    try { localStorage.setItem(storageKey(userId), CURRENT_VERSION); } catch { /* best-effort */ }
  }

  return { show, dismiss };
}
```

Design rules baked into that, all of which matter:

- **Keyed by user id, not just by device.** Devices get shared. A device-wide key would
  show the popup to whoever happened to open the app next and skip it for the person who
  has not seen it.
- **Compared by equality, not by ordering.** The stored value is the version that was seen;
  anything other than the current version means "show it". No version parsing, and a
  rollback still behaves sensibly.
- **Nothing happens until there is a user id.** The gate is inert while signed out.
- **Storage failures are swallowed** in both directions. In a private window the popup
  simply shows each session rather than the app crashing.
- **Only the automatic popup is governed by this.** The manual link in Settings always
  opens the dialog regardless of what has been seen.

### Mounting it

In the app shell, once, at the top level — not inside a page, or it would reappear on every
navigation. Lazy-load the modal with a `null` fallback so a slow chunk never flashes a
spinner over the app:

```jsx
const ChangelogModal = lazy(() =>
  import('./components/ChangelogModal').then((m) => ({ default: m.ChangelogModal }))
);

const changelogGate = useChangelogGate(user?.id);

// … inside the shell's render, alongside toasts and dialog hosts:
{changelogGate.show && (
  <Suspense fallback={null}>
    <ChangelogModal onClose={changelogGate.dismiss} />
  </Suspense>
)}
```

**If the product has a second app** (an admin tool, say) sharing the same browser origin,
mount the same gate there with a **namespaced id**:

```jsx
const changelogGate = useChangelogGate(admin?.id ? `admin:${admin.id}` : null);
```

Without the prefix, two unrelated people whose ids collide across separate databases could
answer the popup for each other.

---

## 7. The manual entry points

### 7.1 Bottom of the Settings screen

The last thing on the screen, after every actual setting, as a quiet full-width
underlined link-styled button:

```jsx
const ChangelogModal = lazy(() => import('../components/ChangelogModal').then((m) => ({ default: m.ChangelogModal })));

<button type="button" className="version-link" onClick={() => { feedback(); setShowChangelog(true); }}>
  <App> v{CURRENT_VERSION} — What's New
</button>

{showChangelog && (
  <Suspense fallback={null}>
    <ChangelogModal onClose={() => setShowChangelog(false)} />
  </Suspense>
)}
```

Structural styling (colours from the app's tokens):

```css
.version-link {
  display: block; width: 100%; min-height: 44px; padding: 12px; margin-top: 20px;
  text-align: center; font-size: .7rem; background: none; border: none;
  text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
  color: var(--on-surface-variant);
}
.version-link + .version-link { margin-top: 0; }   /* stacked closing links sit together */
```

It reads as a quiet closing note about the app itself, not as a setting. If the app also
links a user guide or similar, put it directly underneath, sharing the same treatment.

### 7.2 A second app's account screen

Same idea, rendered as a `text` button with a `history_edu` icon inside an "About" card:
`<App> Admin v{CURRENT_VERSION} — What's New`.

Both entry points lazy-load the same modal for the same reason: the array should only ever
load when somebody actually asks for it.

---

## 8. Release discipline: keeping one version number

The version is stated in places that cannot import each other. Map these onto the target
app and drop the ones it does not have:

| Where | Why it cannot just import the others |
|---|---|
| `package.json` `"version"` | A package-manager field. |
| The server's `APP_VERSION` constant | A different module system, read by the API and its health payload. |
| `src/lib/version.js` `CURRENT_VERSION` | What Settings displays. |
| `src/lib/changelog.js` — newest entry | What "What's New" shows. |
| `README.md` title | Docs, tied by convention to the newest release section. |
| A user-facing guide page that states the version it describes | Static HTML outside the build; it can go stale in a way nothing else does. |

These **will** drift if the only thing stopping them is somebody remembering. So the check
runs as part of the build, not as a script someone has to invoke.

`scripts/check-version.mjs` — deliberately regex-based over the raw file text: no build
step, no dependency, and it behaves identically from the package scripts, from CI, or by
hand.

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function extract(label, file, re) {
  const match = read(file).match(re);
  return { label, file, version: match ? match[1] : null };
}

const sources = [
  extract('package.json "version"', 'package.json',         /"version":\s*"([^"]+)"/),
  extract('APP_VERSION',            'server/config.js',     /APP_VERSION\s*=\s*'([^']+)'/),
  extract('CURRENT_VERSION',        'src/lib/version.js',   /CURRENT_VERSION\s*=\s*'([^']+)'/),
  extract('CHANGELOG[0].version',   'src/lib/changelog.js', /version:\s*'([^']+)'/),
  extract('README title',           'README.md',            /^#\s+\S+\s+v([^\s]+)\s*$/m),
  extract('guide version',          'public/guide.html',    /data-guide-version="([^"]+)"/),
];

const unreadable = sources.filter((s) => s.version === null);
if (unreadable.length) {
  console.error('Version check failed — could not find a version in:');
  for (const s of unreadable) console.error(`  ${s.file} (${s.label})`);
  console.error('\nThe file moved or its format changed; update this script to match.');
  process.exit(1);
}

const versions = [...new Set(sources.map((s) => s.version))];
if (versions.length > 1) {
  console.error('Version check failed — the app version disagrees with itself:\n');
  for (const s of sources) console.error(`  ${s.version.padEnd(10)} ${s.file} (${s.label})`);
  console.error('\nBump every one of the above to the same version. A new release also needs');
  console.error('a matching entry at the top of the changelog and a matching README section.');
  process.exit(1);
}

console.log(`Version check passed — v${versions[0]} in all ${sources.length} places.`);
```

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

### The release checklist

Every user-visible change ships with all of this, in one commit:

1. Bump the version in **every** place the script checks.
2. Prepend one entry to `CHANGELOG` — `version`, `title`, `items`.
3. Add a matching section at the top of the README (`## v2.4.0 — <the same title>`), at
   whatever length the change deserves; this is where technical detail, migration steps and
   deploy ordering live.
4. Revisit any hand-written guide or docs that replicate the app's screens.
5. Run the build; the check either passes or names the file you missed.

---

## 9. How to write the entries — this is the part that makes it good

The array is read by the people who use the app, not by developers. The house style:

**Write the title as a sentence about what is now true.**
Good: *"The setting that would not save."* *"A bar that tells you where you are."*
*"Things sitting where they belong."*
Not: *"Fix config migration."* *"v2.4.0 release."*

**Describe the outcome the person sees, then the cause if it helps.**
*"Choosing a default for new entries failed with an error on every account created before
this month. The setting itself was right; the place it saves into was never added to older
accounts."*

**Say what was and was not affected — especially for data.** People's first question about
a bug in anything that stores records is whether something was lost.
*"Nothing was lost or wrongly recorded by this."*

**Name screens the way the app names them.** Use the labels on the buttons and headings a
person actually sees — never component names, file names or route ids.

**Say when a change does not affect them.** *"Nothing about this app has changed. This is
on the separate administrators' tool."*

**Explain a default when a new setting appears**, so the reader knows whether they need to
do anything: *"Everyone starts on the setting that matches how the app already behaved, so
nothing changes until an administrator picks something else."*

**Keep it to a handful of items** — roughly two to five per release. Group small related
fixes into one line rather than listing every commit.

**Technical detail belongs in the README section, not here.** Schema versions, migration
ordering, module formats: the changelog says what changed for the person using the app; the
README says what changed in the system.

**Never rewrite a shipped entry.** If it was wrong, the next entry says so.

---

## 10. Acceptance checklist

- [ ] `CURRENT_VERSION` lives in its own module, and the changelog array is not imported by anything that only displays the version.
- [ ] Displaying the version number anywhere does not pull the changelog array into that bundle (check the built chunks).
- [ ] A dev-mode warning fires when the newest entry and `CURRENT_VERSION` disagree.
- [ ] The dialog lists every entry newest-first, with the newest chip visually distinguished.
- [ ] The dialog closes by Escape, by the close button, and by clicking the overlay, and returns focus to whatever opened it.
- [ ] After a version bump, the first app open by a signed-in person shows the dialog automatically.
- [ ] Dismissing it stores the version, and it does not reappear for that person until the next bump.
- [ ] A second person signing in on the same device still gets shown the dialog.
- [ ] The gate does nothing while signed out.
- [ ] A private window (throwing storage) degrades to "shows each session" rather than an error.
- [ ] The Settings version link opens the dialog regardless of what has been seen.
- [ ] Both entry points lazy-load the modal, with no spinner flash.
- [ ] The dialog is legible in both light and dark mode, dividers included.
- [ ] The build fails if any one of the version sources is left behind.

---

## 11. File manifest

A reference layout. Map it onto whatever structure the target app uses.

| File | Role |
|---|---|
| `src/lib/version.js` | `CURRENT_VERSION`, alone. |
| `src/lib/changelog.js` | The `CHANGELOG` array + the dev-mode drift warning. |
| `src/components/ChangelogModal.jsx` | The "What's New" dialog. |
| `src/hooks/useChangelogGate.js` | Once-per-person, once-per-version gate. |
| `src/AppShell.jsx` | Mounts the gate for the main app. |
| `src/pages/SettingsPage.jsx` | The version link that opens the dialog manually. |
| `scripts/check-version.mjs` | Build-time check that every version source agrees. |
