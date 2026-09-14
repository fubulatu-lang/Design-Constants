# The token system: light and dark mode

Build this before anything that uses colour — every other screen depends on it.

> Extracted from the My Account specification, where this system is what the appearance
> picker actually drives. It is reproduced here because the changelog dialog and the user
> management screen depend on the same tokens. The copy-ready files are
> `../assets/tokens.css` and `../assets/theme.js`.

## Contents

- [One rule: two attributes on `<body>`](#one-rule-two-attributes-on-body-tokens-for-everything-else)
- [The neutral scale](#the-neutral-scale)
- [What "true black" actually requires](#what-true-black-actually-requires)
- [Applying the theme, including before first paint](#applying-the-theme-including-before-first-paint)
- [The accent and status tokens — yours to supply](#the-accent-and-status-tokens--yours-to-supply)
- [Checking the work](#checking-the-work)

---


## One rule: two attributes on `<body>`, tokens for everything else

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

## The neutral scale

These values are real and specified exactly — the dark theme depends on them. Everything
non-neutral (accent, status colours) is yours to supply; see the accent tokens section below.

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

## What "true black" actually requires

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
than its light-mode value — rather than reusing one hex in both. See the accent tokens section below.

Two smaller rules worth keeping:

- **Do not put pure black text on anything in dark mode.** If an accent is light enough to
  need dark text on it, use `#0b0b0c`, not `#000000`.
- **Images and illustrations need a check.** Anything shipped with a baked-in white
  background will glow. Give such assets a transparent background, or a container that
  dims them in dark mode (`filter: brightness(.85)` is usually enough).

## Applying the theme, including before first paint

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

## The accent and status tokens — yours to supply

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

## Checking the work

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

