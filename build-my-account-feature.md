# How to Build the "My Account" Feature

A complete, self-contained specification of a **My Account** screen: the place a
signed-in person changes their own password and the preferences that belong to them and
their device. Hand this file to a coding agent working on any app and it should be able
to build the feature end to end.

Nothing here is tied to a particular product or industry. Where a name, a label or a
storage key is needed, `<App>` and `<app>` stand for yours — replace them throughout.
Brand and accent colours are left as placeholders for you to fill in; the neutral values
in §7 are real, because the dark theme depends on the exact ones given.

---

## 1. What the feature is, in one paragraph

My Account is a single settings sub-screen gathering everything a signed-in person can
change **about themselves and about this device**, and nothing else. It holds four
things, in this order: their password, how the app looks (light or dark, plus an accent
colour), whether the app can be installed to the home screen, and how the app feels when
touched (vibration strength and tap-sound volume). It is reached from the main Settings
screen, it has its own back button, and every preference on it except the password is
stored in the browser rather than on the server.

The organising idea is that a settings screen is **read far more often than it is
changed**. So the password form is folded away behind a button until someone asks for it,
and the preferences that are one tap each are shown open.

---

## 2. Prerequisites in the target app

Build or map these before starting. If the app already has equivalents, use them — do not
introduce a second component library.

| Needed | What it must do |
|---|---|
| `TopBar` | Screen title bar accepting a `title` and a `leading` slot for a back button. |
| `BackButton` | Calls the navigation "go back" action. |
| `Card` | A rounded surface. Needs at least a default and an "elevated" variant. |
| `CardTitle` | A heading inside a card taking an `icon` name and optional `tone` (tints the icon only). |
| `Button` | Variants `filled`, `tonal`, `outlined`, `text`; sizes including `sm`; props `icon`, `loading`, `onClick`, `type`. |
| `TextField` | Controlled input with `label`, `value`, `onChange(value)`, `type`, `autoComplete`, `helperText`. **Password fields must get a show/hide toggle automatically**, with no opt-in from the page. |
| `Alert` | Inline status banner with `error` / `success` variants. Renders nothing when it has no children. `error` uses `role="alert"`, `success` uses `role="status"`. |
| `Reveal` | The collapse-until-asked wrapper. Full spec in §5.1 — build it if the app has nothing like it. |
| Icon set | Material-Symbols-style names are used below (`account_circle`, `password`, `install_mobile`, `vibration`, `volume_up`, `download`, `light_mode`, `dark_mode`, `brightness_auto`). Substitute freely. |
| Navigation | Something that can `navigate('accountSettings')` and `back()`. |
| API client | A `post(path, body)` that throws an `Error` whose `message` is the server's error string. |

---

## 3. Entry point and routing

1. Register the page in the app shell's page map under the key `accountSettings`, and
   **lazy-load it** — it is a sub-screen most sessions never open:

   ```jsx
   const AccountSettingsPage = lazy(() =>
     import('./pages/AccountSettingsPage').then((m) => ({ default: m.AccountSettingsPage }))
   );

   const PAGES = { /* …, */ accountSettings: AccountSettingsPage };
   ```

2. On the main Settings screen, under a "Manage" group heading, put it **first** in the
   tile grid:

   ```jsx
   <Tile icon="account_circle" label="My Account" onClick={() => navigate('accountSettings')} />
   ```

   It goes first because it is the only tile on that screen about the person looking at
   it; everything else there is about the organisation's data.

3. The page itself is a stacked sub-screen, not a tab: a `TopBar` titled **"My Account"**
   with a `BackButton` in the leading slot, and a body of
   `<main className="main-content" id="main-content">`.

---

## 4. Screen structure (exact order)

```
TopBar: "My Account"  [back]
main
├── Password card                      (no section heading above it)
├── section heading: "Appearance"
├── Appearance card  (Mode row, Accent row, Font size row)
├── Install App card (self-hides when already installed)
├── section heading: "Feedback"
├── Haptics card
└── Touch Sounds card
```

Rules that matter:

- **The password card has no section heading.** It is the one thing on the screen that is
  not a device preference, and it is first because it is the most consequential.
- Section headings ("Appearance", "Feedback") sit **above** their cards, outside them. Do
  not also put the word "Appearance" as a card title inside the card — that is the word
  twice. The heading is smaller than the page title, sits close to what it heads, and
  well clear of what came before it.
- The Install card sits under the Appearance heading rather than getting one of its own;
  a heading for a single card that often is not there at all is noise.

```jsx
export function AccountSettingsPage() {
  const { back } = useNavigation();
  return (
    <>
      <TopBar title="My Account" leading={<BackButton onClick={back} />} />
      <main className="main-content" id="main-content">
        <ChangePasswordCard />

        <h2 className="section-header">Appearance</h2>
        <AppearanceCard />
        <InstallAppCard />

        <h2 className="section-header">Feedback</h2>
        <HapticsCard />
        <SoundCard />
      </main>
    </>
  );
}
```

---

## 5. The Password card

### 5.1 The `Reveal` component (build this first)

A form that stays folded away until someone asks for it.

**Props**

| Prop | Meaning |
|---|---|
| `label` | Text on the collapsed button, e.g. `"Change Password"`. |
| `icon` | Icon on that button. |
| `summary` | Node rendered **while collapsed**, above the button — describes the present state. |
| `variant` | Button variant, default `tonal`. |
| `onCancel` | Called when the form is folded away by the Cancel button. |
| `busy` | While true, the Cancel button is not rendered. |
| `collapseWhen` | When this flips from false to true, the form folds itself away. |
| `style` | Applied to the collapsed toggle button. |
| `children` | The form. **May be a function** receiving the Cancel button as its argument. |

**Behaviour**

- Collapsed: renders `summary`, then one button labelled `label` with `aria-expanded="false"`.
- Expanded: renders the children, with `aria-expanded="true"` on the Cancel button.
- On expanding, **focus the first `input, textarea, select`** inside the body. Someone who
  taps "Change Password" means to start typing.
- `collapseWhen` must only act on the **rising edge** (track the previous value in a ref).
  If it acted whenever the value is true, a lingering success flag would make the form
  impossible to reopen.
- `collapseWhen` must **not** call `onCancel`. A caller that just succeeded has already
  cleared its own fields, and calling it would wipe the success message the person still
  needs to read.
- Cancel is hidden while `busy`, so nothing vanishes out from under a request in flight.
- The function-child form exists so Save and Cancel can sit **on the same row**. If Cancel
  is appended after the children instead, it lands outside the caller's `<form>` and the
  two buttons stack on separate lines — which makes one decision look like two.

```jsx
export function Reveal({ label, icon, summary, variant = 'tonal', onCancel, busy, collapseWhen, style, children }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef(null);
  const wasCollapsing = useRef(collapseWhen);

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    const first = bodyRef.current.querySelector('input, textarea, select');
    if (first) first.focus();
  }, [open]);

  useEffect(() => {
    if (collapseWhen && !wasCollapsing.current) setOpen(false);
    wasCollapsing.current = collapseWhen;
  }, [collapseWhen]);

  function close() { setOpen(false); if (onCancel) onCancel(); }

  if (!open) {
    return (
      <>
        {summary}
        <Button variant={variant} size="sm" icon={icon} aria-expanded="false" style={style} onClick={() => setOpen(true)}>
          {label}
        </Button>
      </>
    );
  }

  const cancel = busy ? null : (
    <Button variant="text" size="sm" aria-expanded="true" onClick={close}>Cancel</Button>
  );

  return (
    <div ref={bodyRef}>
      {typeof children === 'function' ? children(cancel) : <>{children}{cancel}</>}
    </div>
  );
}
```

### 5.2 The card itself

- Card title: icon `password`, text **"Password"**.
- Collapsed summary text:
  > "Your password is only ever known to you. Nobody, including an administrator, can read it back."
- Reveal button label: **"Change Password"**.
- Three password fields, in this order:
  1. **Current Password** — `autoComplete="current-password"`
  2. **New Password** — `autoComplete="new-password"`, helper text
     *"At least 8 characters, with a letter and a number"*
  3. **Confirm New Password** — `autoComplete="new-password"`
- One action row: a `tonal` `sm` button **"Update Password"** with a `loading` state, and
  the Cancel button handed in by `Reveal`, side by side.
- Error and success `Alert`s render **below the Reveal**, so they survive the form folding
  itself away on success.

### 5.3 Submit logic (exact order of checks)

```jsx
async function submit() {
  setError(null);
  setSuccess(null);
  if (!currentPassword) { setError('Enter your current password'); return; }
  const policyError = validatePassword(newPassword);
  if (policyError) { setError(policyError); return; }
  if (newPassword !== confirmPassword) { setError('New passwords do not match'); return; }
  setSaving(true);
  try {
    await changePassword({ currentPassword, newPassword });
    setSuccess('Password updated');
    setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
  } catch (e) {
    setError(e.message);          // the server's message, shown as-is
  } finally {
    setSaving(false);
  }
}
```

Cancel must **forget** what was typed. Collapsing unmounts the children, but the values
live in the caller's state, so three half-filled password boxes would still be sitting
there on the next reveal:

```jsx
function clear() {
  setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
  setError(null); setSuccess(null);
}
```

Wire it as `<Reveal onCancel={clear} busy={saving} collapseWhen={!!success} …>`.

### 5.4 Password policy (shared client and server)

```js
const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password) {
  if (!password) return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}
```

Returns an error message string, or `null` when valid. The **server enforces the same rule
with its own copy** — the client copy exists only to answer instantly.

### 5.5 Server endpoint

`POST /auth/change-password`, behind the normal session-auth middleware.
Body: `{ currentPassword, newPassword }`.

```js
router.post('/change-password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const policyError = validatePassword(newPassword);
  if (policyError) return res.status(400).json({ error: policyError });

  const result = await req.db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Not found' });

  // Skip the current-password check ONLY on a forced first-login change, where the
  // person is proving identity with the temporary password they were just handed.
  if (!user.must_change_password) {
    if (!currentPassword) return res.status(400).json({ error: 'Enter your current password' });
    const valid = await bcrypt.compare(currentPassword, user.password_hash || '');
    if (!valid) return res.status(403).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await req.db.query(
    'UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2',
    [passwordHash, req.user.id]
  );
  res.json({ message: 'Password updated' });
}));
```

**Non-negotiable detail:** a wrong current password must return **403, not 401**. The
session is perfectly valid — the person mistyped. Most API clients treat 401 as an expired
session and sign the user out, so a single typo on this screen would log them out instead
of telling them it was a typo.

The endpoint always clears `must_change_password`, so the same route serves both this
screen and a forced-change-on-first-login screen.

---

## 6. The Appearance card

Two independent axes, on two rows of one card. **Build it as a shared component**, not as
code copied into each screen that shows it — if the product has a second, administrator-
facing app with its own account screen, both render the same component. Two copies drift.

### 6.1 The two axes

```js
// How bright the room is. "System" has no styling of its own — it resolves to
// light or dark from the OS and stays in sync if that changes while the app is open.
export const MODES = [
  { value: 'light',  label: 'Light',  icon: 'light_mode' },
  { value: 'dark',   label: 'Dark',   icon: 'dark_mode' },
  { value: 'system', label: 'System', icon: 'brightness_auto' },
];

// Which colour the product is. `swatch` is the light-mode primary of each accent,
// purely so the picker can show the colour rather than only name it.
export const ACCENTS = [
  { value: 'accentOne', label: '<Your first accent>',  swatch: '<hex>' },
  { value: 'accentTwo', label: '<Your second accent>', swatch: '<hex>' },
];
```

Keep them as two controls rather than one list of every combination. Mode is about the
room you are in and accent is about the product; they change for different reasons, and a
combined list would have to grow by a whole row per accent.

One accent is fine. Two or three is the useful range — past that the row wraps and the
choice stops feeling like a choice.

### 6.2 Storage and application

- Keys: `<app>.mode` and `<app>.accent`.
- Defaults for a fresh install: `mode: 'system'`, `accent: <first accent>`.
- Anything read from storage that is not in the known value list is ignored, not trusted.
- Wrap every `localStorage` read and write in `try/catch` — private windows throw.
- If migrating from an older single-value theme key, read it once, split it across the two
  axes, then leave it alone.

```js
export function readThemePreference() {
  let mode = null, accent = null;
  try {
    mode = localStorage.getItem(MODE_KEY);
    accent = localStorage.getItem(ACCENT_KEY);
  } catch { /* private window */ }
  return {
    mode:   MODE_VALUES.includes(mode)     ? mode   : 'system',
    accent: ACCENT_VALUES.includes(accent) ? accent : ACCENTS[0].value,
  };
}
```

The hook keeps a `matchMedia('(prefers-color-scheme: dark)')` listener alive **only** while
the mode is `system`, and only for the mode:

```js
export function useTheme() {
  const [{ mode, accent }, setPref] = useState(readThemePreference);

  useEffect(() => {
    applyThemePreference({ mode, accent });
    if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyThemePreference({ mode: 'system', accent });
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mode, accent]);

  const write = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

  return {
    mode, accent,
    setMode:   (next) => { write(MODE_KEY, next);   setPref((p) => ({ ...p, mode: next })); },
    setAccent: (next) => { write(ACCENT_KEY, next); setPref((p) => ({ ...p, accent: next })); },
  };
}
```

`applyThemePreference` is specified in §7.4 — it is the bridge between this picker and the
token system.

### 6.3 The card's markup

One card, two stacked rows, no card title. Each row is a label, a note, and a wrapping row
of chip-style buttons — the selected one `filled`, the rest `tonal`. The last row drops its
bottom border.

```jsx
export function AppearanceCard() {
  const { mode, accent, setMode, setAccent } = useTheme();
  return (
    <Card>
      <Choice label="Mode"   note={MODE_NOTE}   options={MODES}   value={mode}   onChange={setMode} />
      <Choice label="Accent" note={ACCENT_NOTE} options={ACCENTS} value={accent} onChange={setAccent} last />
    </Card>
  );
}

function Choice({ label, note, options, value, onChange, last }) {
  return (
    <div className="setting-row setting-row-stacked" style={last ? { borderBottom: 'none' } : undefined}>
      <div className="setting-row-label">{label}</div>
      <div className="setting-row-note">{note}</div>
      <div className="setting-row-choices">
        {options.map((o) => (
          <Button key={o.value} variant={value === o.value ? 'filled' : 'tonal'} size="sm" icon={o.icon}
                  onClick={() => onChange(o.value)}>
            {o.swatch && value !== o.value && (
              <span className="accent-swatch" aria-hidden="true" style={{ background: o.swatch }} />
            )}
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

Notes to write beside each row:

- Mode: *"Dark uses true black, easier on the eyes and the battery on OLED screens. System
  follows your device and switches with it."*
- Accent: *"The colour used for buttons, links and the highlighted tab. Independent of the
  mode, so any pairing works."*

**Swatch rule:** the colour dot is dropped on the selected chip. That chip is already the
colour, and a dot of the same hue on it reads as a smudge.

**Layout rule:** rows are stacked (label above control), not label-left / control-right. A
segmented control will not fit in a right-hand gutter on a 360px phone the way a single
switch does.

> **Superseded in v4.3.0 — read §6.4 before implementing §6.3.** The chip row described
> above shipped, and was then replaced by a segmented control. The two axes, the storage
> and the notes are unchanged; only the control is different.

---

### 6.4 What shipped instead: the segmented control (v4.3.0)

A row of separate chips reads as several independent buttons that happen to sit near each
other, rather than as **one choice with N answers**. At five options it also wrapped 3 + 2
on a phone and stranded the last one on a line of its own.

Replace it with one sunken track holding equal-width segments, the selected one raised out
of it:

```jsx
<div className="segmented" role="radiogroup" aria-label={label}>
  {options.map((o) => (
    <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
            className={`segment${value === o.value ? ' segment-selected' : ''}`}
            onClick={() => onChange(o.value)}>
      {o.swatch && value !== o.value && <span className="accent-swatch" style={{ background: o.swatch }} />}
      {o.label}
    </button>
  ))}
</div>
```

```css
.segmented{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:2px;
  background:var(--segment-track);border-radius:16px;padding:4px}
.segment{padding:10px 6px;border:1px solid transparent;border-radius:11px;
  background:transparent;color:var(--on-surface-variant);font-weight:600;font-size:.82rem;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.segment-selected{background:var(--segment-thumb);color:var(--on-surface);
  border-color:var(--segment-thumb-border);box-shadow:0 1px 3px rgba(0,0,0,.10)}
```

The rules that matter:

- **`role="radiogroup"` of `role="radio"` buttons, not a `<fieldset>` of inputs.** Selection
  applies instantly and there is nothing to submit, so real radios would promise a form
  that does not exist. `aria-checked` is what conveys the selection.
- **`grid-auto-flow: column`**, so nothing has to declare how many segments there are and
  they are always equal. This is what makes five fit one line — which is why the level
  labels become `Off`/`1`/`2`/`3`/`4` rather than `Off`/`Light`/`Medium`/`Strong`/`Max`.
  Keep the durations and volumes behind those labels unchanged.
- **The selected segment is raised, not accent-coloured.** Making it the primary puts a
  saturated block on every row of a screen that is nothing but rows.
- **Give the track and thumb their own two tokens.** Do not reuse the surface ladder: in
  dark mode the thumb must be *lighter* than the track, and the light-mode pairing inverted
  reads as a hole rather than a selection.
- The swatch dot rule from §6.3 is unchanged — dropped on the selected segment.

### 6.5 Font size (v4.3.0)

A third row in the same card: Smaller / Normal / Large, as one more segmented control.

```css
html{font-size:calc(16px * var(--font-scale, 1))}
```

```js
const FONT_SIZES = [
  { value: 'small',  label: 'Smaller', scale: 0.92 },
  { value: 'normal', label: 'Normal',  scale: 1 },
  { value: 'large',  label: 'Large',   scale: 1.12 },
];
export function applyFontSize(value) {
  document.documentElement.style.setProperty('--font-scale', SCALES[value] ?? 1);
}
```

- **One multiplier on the root, nothing else.** If the app sizes in rem, this scales all of
  it with no per-screen overrides and nothing to keep in sync. If it does not, fix that
  first — a font-size setting is not worth a hundred hand-written exceptions.
- **The steps are deliberately narrow.** Far enough apart to be worth choosing, close
  enough that no layout has to be redrawn for them.
- **Apply it before the framework mounts**, in the same place as the theme (§7.4). Read it
  after the first paint and every line of text visibly resizes a frame in.
- **Form controls must not shrink with it.** Give them a floor in px
  (`font-size: max(.9rem, 14.4px)`): small text in a field is where iOS Safari starts
  zooming and panning the page on focus. If the app's fields are already under 16px, that
  zoom already happens — raising them is an app-wide restyle and not something to do as a
  side effect of adding this row.
- **44px touch targets stay 44px.** A thumb does not get smaller when the text does.

## 7. Light and dark mode — the token system

This is what the picker in §6 actually drives. Build it before the picker if the app has
no theming yet, because every other screen depends on it.

### 7.1 One rule: two attributes on `<body>`, tokens for everything else

No component ever asks what the theme is. Components use CSS custom properties; the theme
is two data attributes on `<body>`, and the stylesheet redefines the properties beneath
them:

```html
<body data-mode="dark" data-accent="accentOne">
```

`data-mode` is **only ever `light` or `dark`** — `system` is resolved in JavaScript before
it is written, so the stylesheet never has to know that "system" exists.

If a component needs to know the mode in JS (a canvas, a chart, a map), read
`document.body.dataset.mode`. Never branch on `prefers-color-scheme` inside a component:
that ignores an explicit choice.

### 7.2 The neutral scale

These values are real and specified exactly — the dark theme depends on them. Everything
non-neutral (accent, status colours) is yours to supply; see §7.5.

```css
:root {
  /* ---- Light: the default, no attribute needed ---- */
  --surface:                #f2f3f5;  /* the page ground */
  --surface-container:      #ffffff;  /* cards, sheets, menus */
  --surface-container-high: #e9ebee;  /* hover / pressed / selected rows */
  --on-surface:             #14161a;  /* primary text */
  --on-surface-variant:     #5a6069;  /* secondary text, notes, helper text */
  --outline:                #c3c8ce;  /* borders on interactive things */
  --outline-variant:        #dfe3e7;  /* dividers, card hairlines */
  --shadow-color:           rgba(0, 0, 0, .12);
  --scrim:                  rgba(0, 0, 0, .40);  /* behind modals */
}

body[data-mode="dark"] {
  /* ---- Dark: true black ---- */
  --surface:                #000000;  /* the ground IS black — see 7.3 */
  --surface-container:      #0b0b0c;  /* cards sit one step above the ground */
  --surface-container-high: #17181a;  /* hover / pressed / selected rows */
  --on-surface:             #e8eaed;  /* primary text — not pure white */
  --on-surface-variant:     #9aa0a6;  /* secondary text */
  --outline:                #3c4043;
  --outline-variant:        #26282b;  /* dividers: visible, never bright */
  --shadow-color:           rgba(0, 0, 0, .60);
  --scrim:                  rgba(0, 0, 0, .65);
}
```

Contrast, so you can check the work: `#14161a` on `#f2f3f5` is about 16:1; `#e8eaed` on
`#000000` is about 17:1; `#9aa0a6` on `#000000` is about 8.6:1 and on `#0b0b0c` about 8:1.
All comfortably past WCAG AA for body text, which is 4.5:1.

### 7.3 What "true black" actually requires

An OLED screen switches individual pixels off at `#000000`. That is the point: deeper
contrast in a dark room, and measurably less battery on the large dark areas an app spends
its life showing. But a black ground breaks three habits that work fine on a grey one, and
all three have to be handled deliberately.

**1. Elevation is a lighter surface, never a shadow.** A drop shadow on black is invisible
— black on black. So a card is distinguished by being *lighter than the ground*, and the
elevation ladder runs upward from `#000000`:

| Level | Light mode | Dark mode | Used for |
|---|---|---|---|
| Ground | `--surface` `#f2f3f5` | `--surface` `#000000` | the page behind everything |
| +1 | `--surface-container` `#ffffff` | `--surface-container` `#0b0b0c` | cards, sheets, menus, the top bar |
| +2 | `--surface-container-high` `#e9ebee` | `--surface-container-high` `#17181a` | hover, pressed, selected |

```css
.card {
  background: var(--surface-container);
  border-radius: 16px;
}
/* Shadow in light mode only — it does nothing on black but cost paint time. */
.card.elevated { box-shadow: 0 1px 3px var(--shadow-color); }
body[data-mode="dark"] .card.elevated {
  box-shadow: none;
  border: 1px solid var(--outline-variant);   /* the edge a shadow used to give */
}
```

**2. Never pure white text on true black.** `#ffffff` on `#000000` haloes and smears on
OLED, especially while scrolling, and reads as harsh at night. Cap primary text at
`#e8eaed`. The same applies to large white fills: a full-width white button on black is a
flashlight.

**3. Saturated colour needs toning down.** An accent tuned for white backgrounds usually
vibrates against black. Give each accent a dark-mode variant — lighter and less saturated
than its light-mode value — rather than reusing one hex in both. See §7.5.

Two smaller rules worth keeping:

- **Do not put pure black text on anything in dark mode.** If an accent is light enough to
  need dark text on it, use `#0b0b0c`, not `#000000`.
- **Images and illustrations need a check.** Anything shipped with a baked-in white
  background will glow. Give such assets a transparent background, or a container that
  dims them in dark mode (`filter: brightness(.85)` is usually enough).

### 7.4 Applying the theme, including before first paint

```js
function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function applyThemePreference({ mode, accent }) {
  const resolved = mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;
  document.body.dataset.mode = resolved;
  document.body.dataset.accent = accent;

  // Lets the browser theme its own furniture: form controls, scrollbars,
  // the caret, and the ground behind an over-scrolled page.
  document.documentElement.style.colorScheme = resolved;

  // The browser/OS chrome around the app (Android address bar, iOS status
  // area in standalone mode). Without it the frame stays light while the
  // app goes black, and the seam is very visible.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#f2f3f5');
}
```

**Call this from the app's entry file before the framework mounts**, reading straight from
storage. Otherwise the app paints light, then flips — a white flash on every cold start,
which is exactly what a dark-mode user is trying to avoid:

```js
// entry file, before render()
applyThemePreference(readThemePreference());
```

For the very first paint on a slow connection, set the ground in the HTML document itself
so even an empty page is the right colour:

```html
<meta name="theme-color" content="#f2f3f5" />
<style>
  html { background: #f2f3f5; }
  @media (prefers-color-scheme: dark) { html { background: #000000; } }
</style>
```

### 7.5 The accent and status tokens — yours to supply

Every non-neutral colour is defined per accent, under both modes. The structure is fixed;
the values are yours:

```css
body[data-accent="accentOne"] {
  --primary:             <accent, tuned for light backgrounds>;
  --on-primary:          <text on that: usually #ffffff>;
  --primary-container:   <a pale wash of the accent, for tonal buttons/chips>;
  --on-primary-container:<text on that wash>;
}
body[data-mode="dark"][data-accent="accentOne"] {
  --primary:             <lighter, less saturated than the light value>;
  --on-primary:          <text on that: usually #0b0b0c, never #000000>;
  --primary-container:   <a dark, desaturated tint — not the pale wash>;
  --on-primary-container:<text on that tint>;
}

/* Status colours follow exactly the same pattern, in both modes. */
:root { --success: <…>; --warning: <…>; --error: <…>; --info: <…>; }
```

Rules for picking them:

- **Check contrast in both modes, not one.** Body text and icons need 4.5:1 against the
  surface they sit on; large text and UI borders need 3:1. A colour that passes on white
  very often fails on `#0b0b0c`, and the reverse.
- **Dark-mode accents go lighter and flatter.** As a starting point, raise lightness by
  15–25% and cut saturation by 10–20% from the light-mode value, then check contrast.
- **Never let colour be the only signal.** Every state that matters carries a word or an
  icon as well — this survives dark mode, colour-blindness and a bad screen in sunlight.
- **Do not add a third mode.** Light, dark and "follow the system" is the complete set.
  "Dim" as a separate mode doubles the palette you have to maintain for a difference most
  people cannot name.

### 7.6 Checking the work

- Every colour in the app comes from a token. Grep the stylesheet for `#` outside the two
  token blocks — each hit is a colour that will be wrong in one mode.
- Switch modes with the app open, on every screen: nothing should need a reload.
- Set the OS to dark with the app on "System", then change the OS setting while the app is
  open. It must follow, live.
- Cold-start on dark: no white flash, not even for a frame.
- In dark mode, the ground is exactly `#000000` — sample it with a colour picker rather
  than trusting your eye, since `#0b0b0c` looks identical in a screenshot and is not the
  same on an OLED panel.
- Every card is distinguishable from the ground in dark mode without relying on a shadow.

---

## 8. The Install App card

Only relevant if the app is a PWA (manifest + service worker + HTTPS).

```jsx
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstallPrompt(e) { e.preventDefault(); setDeferredPrompt(e); }
    function onInstalled() { setInstalled(true); setDeferredPrompt(null); }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }

  return { canInstall: !!deferredPrompt && !installed, promptInstall };
}
```

Card behaviour — four states, one of which is "not there at all":

1. **Already running standalone** (`window.matchMedia('(display-mode: standalone)').matches`)
   → render `null`. There is nothing to offer.
2. **`canInstall`** → a short line on why installing is worth it, plus a `tonal` `sm`
   button with a `download` icon labelled **"Install"** calling `promptInstall`.
3. **iOS** (`/iphone|ipad|ipod/i` against the user agent) → Safari never fires
   `beforeinstallprompt`, so explain the manual path:
   *"On iPhone/iPad: tap the Share icon in Safari, then \"Add to Home Screen.\""*
4. **Anything else without a prompt yet** →
   *"Your browser will offer an install option (often in the address bar) once available."*

`canInstall` staying false on iOS is expected, not a bug.

---

## 9. The Haptics card

Five levels, level 0 is off, the rest ramp up vibration duration. Default is level 2.

```js
const KEY = '<app>.hapticLevel';

export const HAPTIC_LEVELS = [
  { value: 0, label: 'Off',    ms: 0 },
  { value: 1, label: 'Light',  ms: 60 },
  { value: 2, label: 'Medium', ms: 90 },
  { value: 3, label: 'Strong', ms: 120 },
  { value: 4, label: 'Max',    ms: 160 },
];

export function getHapticLevel() {
  const n = parseInt(localStorage.getItem(KEY), 10);
  return Number.isNaN(n) ? 2 : Math.min(4, Math.max(0, n));
}

export function setHapticLevel(level) { localStorage.setItem(KEY, String(level)); }

/** Fires a vibration at the stored level. Silent no-op where the API is missing (iOS Safari). */
export function triggerHaptic() {
  const level = getHapticLevel();
  const ms = HAPTIC_LEVELS[level]?.ms || 0;
  if (ms > 0 && typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(ms); } catch {}
  }
}
```

Card: title icon `vibration`, text **"Haptics"**, note *"Vibration strength when tapping
buttons and navigation."*, then a `choice-grid` of five buttons — selected `filled`, the
rest `tonal`.

**Choosing a level must immediately fire that level as a preview.** Write, then set state,
then trigger — in that order, because the trigger reads the stored value:

```jsx
function choose(v) { setHapticLevel(v); setLevel(v); triggerHaptic(); }
```

---

## 10. The Touch Sounds card

> **Superseded in v4.3.0 by §10.1.** The single synthesised blip below shipped first. It is
> now three sounds — tap, success and error — sharing the one volume setting. The levels,
> the storage key and the card are otherwise unchanged.

Same shape, five volume levels, **default 0 (off)** — a sound that plays on every tap
should be opted into, not out of. Synthesised with Web Audio so there is no audio file to
ship or host.

```js
const KEY = '<app>.soundLevel';

export const SOUND_LEVELS = [
  { value: 0, label: 'Off',    volume: 0 },
  { value: 1, label: 'Quiet',  volume: 0.25 },
  { value: 2, label: 'Medium', volume: 0.5 },
  { value: 3, label: 'Loud',   volume: 0.75 },
  { value: 4, label: 'Max',    volume: 1 },
];

export function getSoundLevel() {
  const n = parseInt(localStorage.getItem(KEY), 10);
  return Number.isNaN(n) ? 0 : Math.min(4, Math.max(0, n));
}

export function setSoundLevel(level) { localStorage.setItem(KEY, String(level)); }

let audioCtx = null;
function getContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

/** A short decaying sine blip — percussive, not a tone. It fires on every tap, so at
 *  normal volumes it has to disappear into the background. */
export function playTouchSound() {
  const level = getSoundLevel();
  const volume = SOUND_LEVELS[level]?.volume || 0;
  if (volume <= 0) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 900;
    gain.gain.setValueAtTime(volume * 0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  } catch {}
}
```

Card: title icon `volume_up`, text **"Touch Sounds"**, note *"Volume of the tap sound when
using the app."*, five buttons, and the same preview-on-choose rule:

```jsx
function choose(v) { setSoundLevel(v); setLevel(v); playTouchSound(); }
```

**One shared audio context, created lazily.** Creating one per tap leaks contexts, and
browsers cap how many you may have.

### 10.1 Three sounds, not one (v4.3.0)

**You cannot use the device's own touch sounds.** No browser exposes the system sound set
to a page, and shipping a recording of a vendor's sound would be redistributing their
audio. Synthesise originals.

One tap sound is also not enough: it says *contact*, and says nothing about whether what
you touched worked. Three sounds, one volume setting:

| Sound | Fires on | Shape |
|---|---|---|
| tap | every tap | ~45 ms. A body falling 1180→620 Hz plus a quiet 2600 Hz partial |
| success | the app saying something worked | ~180 ms. Two warm notes a fifth apart, the second arriving late — a rise |
| error | the app saying something failed | ~180 ms. Two low thuds at one pitch |

```js
/** One sine partial: start pitch, optional glide, peak, length, delay. */
function tone(ctx, master, { from, to, peak, dur, at = 0 }) {
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playTouchSound()  { play((c, m) => { tone(c, m, { from: 1180, to: 620, peak: 1, dur: .075 }); tone(c, m, { from: 2600, peak: .28, dur: .022 }); }); }
export function playSuccessSound(){ play((c, m) => { tone(c, m, { from: 660, peak: .55, dur: .13 }); tone(c, m, { from: 990, peak: .45, dur: .20, at: .075 }); tone(c, m, { from: 1980, peak: .08, dur: .12, at: .075 }); }); }
export function playErrorSound()  { play((c, m) => { tone(c, m, { from: 240, to: 200, peak: .7, dur: .10 }); tone(c, m, { from: 240, to: 190, peak: .6, dur: .13, at: .11 }); }); }
```

What makes these sound expensive rather than cheap, in order of how much it matters:

- **Soft sine partials only.** No square waves, no sawtooth. A square wave is what a cheap
  toy sounds like.
- **Fast attack, short exponential decay, no sustain.** Nothing should ring. The tap fires
  on every single touch, so at normal volumes it has to disappear into the background
  rather than announce itself.
- **A body plus a quieter partial above it**, not one oscillator. One is a beep; two is an
  object being struck.
- **Never a harsh error tone.** A buzz punishes somebody who is already frustrated. Low and
  repeated reads as "no" without scolding.
- **Preview the *tap* when the level is chosen**, not success — the tap is the one that
  fires constantly and so the one worth judging a level by. Previewing the fuller sound
  flatters the setting.

**Where to fire success and error:** the one place the app tells somebody an outcome. If it
has a toast API, that is the hook. If it does not, the inline status/alert component is —
on mount only, and for the success/error variants only. A warning or info banner is context
rather than an outcome, and is often rendered permanently.

### Wiring the preferences into the rest of the app

Both are only worth having if the whole app uses them. Provide one small hook that fires
the haptic and the sound together, and call it from the shared button/tap handlers rather
than from individual screens.

---

## 11. Layout / CSS structure

Structure only — every colour comes from the tokens in §7.

```css
/* Group heading that sits above a card, not inside it. Smaller than the page title. */
.section-header { font-size: .74rem; font-weight: 700; margin: 28px 10px 8px; color: var(--primary); }
.section-header:first-child { margin-top: 4px; }

/* One stacked settings row: label, note, wrapping row of choices. */
.setting-row { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--outline-variant); }
.setting-row:last-child { border-bottom: none; }
.setting-row.setting-row-stacked { display: block; padding: 16px 0; }
.setting-row-label { font-size: .92rem; font-weight: 600; line-height: 1.3; color: var(--on-surface); }
.setting-row-note { font-size: .78rem; line-height: 1.45; margin-top: 3px; color: var(--on-surface-variant); }
.setting-row-choices { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }

/* The colour dot on an unselected accent chip. The inset ring keeps a pale
   swatch visible in light mode and a dark one visible against black. */
.accent-swatch { width: 12px; height: 12px; border-radius: 50%; display: inline-block;
                 box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .25); }

/* Five levels: 3 across on a phone, all 5 across once there is room —
   so the fifth is never stranded alone on a line of its own. */
.choice-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.choice-grid .btn { width: 100%; }
@media (min-width: 560px) { .choice-grid { grid-template-columns: repeat(5, 1fr); } }

/* Save and Cancel on one line. They are one decision with two answers. */
.form-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
```

---

## 12. Accessibility requirements

- The page body is `<main id="main-content">` so a skip link can target it.
- The Reveal toggle carries `aria-expanded` in both states.
- Password inputs get correct `autoComplete` values so password managers behave.
- Error alerts use `role="alert"`; success alerts use `role="status"`.
- Every choice is a real `<button>`, and selection is conveyed by more than colour (the
  filled variant changes weight, and the swatch dot disappears).
- Every tap target on the screen is at least 44px tall.
- Both themes meet contrast minimums — see the numbers in §7.2 and the rules in §7.5.

---

## 13. Optional: a second, administrator-facing app

If the product has a separate admin app that also needs an account screen, build the
**same** screen with two changes, and share every underlying module (theme, haptics, sound,
install prompt, password validation) so a preference set in one holds in the other on the
same device:

1. Add a **"Who you are here"** card above the password card containing a username change
   form — but only if administrators there have nobody to ask for a reset. It uses the same
   `Reveal` pattern; its collapsed summary shows the current username and the previous
   sign-in time; the explanation of *what changing the username means* goes **above** the
   input, while the *format rule* stays as the field's own helper text. Validate
   lowercase-only usernames (`^[a-z0-9._-]{3,30}$`), reject a value identical to the current
   one, and on success say *"Saved. Sign in with the new one next time."* Existing
   audit-log entries keep the name they were written under — say so, because the record has
   to stay true to what happened.
2. Reword the copy for that audience.

---

## 14. Acceptance checklist

- [ ] "My Account" is reachable from Settings and has a working back button.
- [ ] The page is lazy-loaded and does not appear in the initial bundle.
- [ ] The password form is folded away on arrival, showing only the summary line and one button.
- [ ] Expanding it focuses the Current Password field.
- [ ] Every password field has a working show/hide toggle.
- [ ] Empty current password, a policy failure, and a mismatch each show their own message, in that order of precedence, without a network request.
- [ ] A wrong current password shows "Current password is incorrect" **and does not sign the user out**.
- [ ] A successful change shows "Password updated", clears all three fields, and folds the form away with the message still visible.
- [ ] Cancel folds the form away and forgets everything typed — reopening shows empty fields.
- [ ] Mode and accent are independent; every combination renders correctly.
- [ ] Dark mode's page ground is exactly `#000000`, verified with a colour picker.
- [ ] No pure-white text or large pure-white fills anywhere in dark mode.
- [ ] Cards are distinguishable from the ground in dark mode without a drop shadow.
- [ ] "System" follows the OS and changes live when the OS theme changes with the app open.
- [ ] A cold start in dark mode shows no light flash, not even for one frame.
- [ ] The browser/OS chrome (address bar, status area) matches the mode.
- [ ] Every colour in the app resolves from a token; no raw hex outside the token blocks.
- [ ] Theme choices survive a reload and fail gracefully in a private window.
- [ ] The Install card disappears entirely when already installed, and shows manual instructions on iOS.
- [ ] Choosing a haptic level vibrates immediately at that strength; "Off" does nothing.
- [ ] Choosing a sound level plays the click immediately; the default on a fresh install is Off.
- [ ] Five levels never leave one button stranded alone on its own line.
- [ ] Save and Cancel share a line everywhere on the screen.
- [ ] Nothing on this screen can be reached or changed by anyone other than the signed-in person themselves.

---

## 15. File manifest

A reference layout. Map it onto whatever structure the target app uses.

| File | Role |
|---|---|
| `src/pages/AccountSettingsPage.jsx` | The screen: page container + Password / Install / Haptics / Sound cards. |
| `src/components/AppearanceCard.jsx` | Shared Mode + Accent island. |
| `src/hooks/useTheme.js` | `MODES`, `ACCENTS`, read / apply, the `useTheme` hook. |
| `src/styles/tokens.css` | The token blocks from §7 — light, dark, and one per accent. |
| `src/hooks/useInstallPrompt.js` | `beforeinstallprompt` wrapper. |
| `src/lib/haptics.js` | Levels, storage, `triggerHaptic`. |
| `src/lib/touchSound.js` | Levels, storage, synthesised click. |
| `src/lib/validation.js` | `validatePassword` (client copy). |
| `src/services/authService.js` | `changePassword({ currentPassword, newPassword })`. |
| `src/components/ui/Reveal.jsx` | The collapse-until-asked wrapper. |
| `src/main.jsx` (entry) | Applies the theme before the first paint. |
| `server/routes/auth.js` | `POST /auth/change-password`. |
| `server/lib/security.js` | `validatePassword` (the enforced copy). |
