---
name: design-foundations
description: The shared groundwork the changelog, my-account and user-management skills all build on — a light/dark design-token system with a true-black OLED dark theme, accessible dialog/modal plumbing, and a server-owned permission model. Use this whenever the user is setting up dark mode or a theme toggle, defining colour tokens, fixing a white flash on cold start, building a modal or dialog that needs correct focus handling and Escape/overlay closing, or designing per-user permissions and what the client is allowed to trust — and also whenever another Design-Constants skill points here for the underlying pattern.
---

# Design foundations

Three pieces of groundwork that more than one feature depends on. They live here so the
feature skills can point at one description instead of each carrying their own copy and
slowly drifting apart.

Read the piece you need; they are independent of each other.

| Reference | What it covers | Read it when |
|---|---|---|
| `references/tokens.md` | The light/dark token system, the true-black dark theme, and applying a theme before first paint. | Adding theming, dark mode, or any colour to the app. |
| `references/modal-accessibility.md` | What a dialog has to do to be usable by keyboard and screen reader. | Building any modal, dialog, sheet or confirm prompt. |
| `references/permissions.md` | Role defaults, per-person overrides, server enforcement, and what reaches the client. | Building per-user permissions, or any screen that shows or hides things by role. |

## The three ideas, in one line each

**Theming: no component ever asks what the theme is.** Components use CSS custom
properties; the theme is two data attributes on `<body>`, and the stylesheet redefines the
properties beneath them. A component that branches on `prefers-color-scheme` has just
ignored the user's explicit choice.

**Dialogs: the plumbing is the accessibility.** Focus moved in on open and returned to the
trigger on close, Escape, overlay click, `aria-labelledby` pointing at a *generated* id,
body scroll locked. None of it is visible when it works, and all of it is what separates a
dialog from a div that happens to float.

**Permissions: the server owns them and the client never recomputes them.** Hiding a
control is a convenience, never the gate. Every protected route enforces its own permission
independently, re-reading the user row rather than trusting a session token.

## Assets

`assets/` holds copy-ready files for all three: `tokens.css`, `theme.js` and an
`index.html.snippet` for the first paint; `permissions.js` and `permission-labels.js`
for the permission model. The neutral scale in the CSS is
specified exactly — the dark theme depends on those values — while everything non-neutral
(accent, status colours) is left as placeholders for the app to fill in.
