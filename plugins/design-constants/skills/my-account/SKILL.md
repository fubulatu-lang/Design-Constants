---
name: my-account
description: Build a "My Account" settings sub-screen — the one place a signed-in person changes their own password and the preferences belonging to them and their device: light/dark mode and accent colour, install-to-home-screen, haptic vibration strength, and tap-sound volume. Use this whenever the user mentions a My Account page, account settings, profile settings, a change-password form, an appearance or theme picker, dark mode settings, a PWA install prompt, or haptics and sound preferences — and also whenever they are deciding what belongs on a personal settings screen versus an app-wide one, even if they never say "My Account".
---

# My Account

A single settings sub-screen gathering everything a signed-in person can change **about
themselves and about this device**, and nothing else. Four things, in this order: their
password, how the app looks, whether it can be installed to the home screen, and how it
feels when touched.

The full specification is `references/spec.md`. This file is the map.

## The organising idea

A settings screen is **read far more often than it is changed**. So the password form is
folded away behind a button until someone asks for it, and the preferences that are one tap
each are shown open. If you find yourself putting a rarely-used form in front of a
frequently-read value, that is the rule you are breaking.

The second idea is the boundary: this screen holds what is **about the person or their
device**. Anything about the organisation's data belongs on the main Settings screen
instead. That boundary is what stops it becoming a dumping ground.

## Before you start

- **Does the app already have a component library?** The spec lists what it needs
  (`TopBar`, `Card`, `Button`, `TextField`, `Alert`, `Reveal`). Map them onto what exists.
  Do not introduce a second component library for one screen.
- **Does the app have theming at all?** If not, build the token system first — everything
  else on this screen depends on it, and so does every other screen in the app.
- **Is this a PWA?** If not, drop the Install App card rather than building a dead one.
- **Is it a native or Capacitor app?** Haptics and tap sounds mean something different
  there; the web `navigator.vibrate` route in the spec will not apply.

## Build order

1. **The token system first.** It is what the appearance picker actually drives, and every
   other screen depends on it. See `design-foundations` →
   `../design-foundations/references/tokens.md`, with copy-ready
   `tokens.css`, `theme.js` and the first-paint HTML snippet in that skill's `assets/`.
2. Routing and the page shell — lazy-loaded, since most sessions never open it.
3. The Password card (`references/spec.md` §5).
4. The Appearance card (§6).
5. Install App (§8), Haptics (§9), Touch Sounds (§10) — each self-contained.

## Screen structure, in order

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

The password card has **no section heading**: it is the one thing here that is not a device
preference, and it is first because it is the most consequential. Section headings sit
*above* their cards, outside them — do not also title the card "Appearance", that is the
word twice. The Install card shelters under the Appearance heading rather than getting one
of its own, because a heading for a single card that often is not there at all is noise.

## The rules that matter

**Every preference except the password is stored in the browser, not on the server.** They
are about this device. Syncing them would mean a phone's haptic setting fighting a laptop's.

**Resolve "system" before writing it to the DOM.** `data-mode` is only ever `light` or
`dark`. The stylesheet never has to know that "system" exists.

**Apply the theme before the framework mounts.** Read storage in the entry file and set the
attributes there. Otherwise the app paints light and flips — a white flash on every cold
start, which is exactly what a dark-mode user is trying to avoid.

**Never branch on `prefers-color-scheme` inside a component.** That ignores an explicit
choice. Read `document.body.dataset.mode` if a component genuinely needs to know.

**A person changing their own password proves they know the current one.** This is not the
administrator reset flow in `user-management` — do not share an endpoint between them.

**Dark mode is true black, and that has three consequences** worth reading before you pick
any colour: elevation becomes a lighter surface rather than a shadow, primary text stops at
`#e8eaed` rather than white, and saturated accents need a separate darker-mode value. All
three are in `../design-foundations/references/tokens.md`.

## Accessibility

The dialog and control requirements are shared across this plugin's features — see
`../design-foundations/references/modal-accessibility.md`. The ones specific to this
screen: the page body is `<main id="main-content">` so a skip link can target it, the
Reveal toggle carries `aria-expanded` in both states, password inputs get correct
`autoComplete` values so password managers behave, and every tap target is at least 44px.

## Reference files

| File | Read it when |
|---|---|
| `references/spec.md` | Building any part of the screen — the complete original specification, including per-card detail and the acceptance checklist. |
| `../design-foundations/references/tokens.md` | Building the theming the Appearance card drives. |
| `../design-foundations/references/modal-accessibility.md` | Building any dialog or toggle on the screen. |
