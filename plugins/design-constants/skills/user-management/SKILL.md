---
name: user-management
description: Build an administrator-only User Management screen — create accounts, edit details, reset passwords with a one-time temporary password, set per-person permissions, and remove accounts, with the guard rails that stop anyone locking the whole organisation out. Use this whenever the user mentions user management, an admin panel for accounts, creating or inviting users, roles and permissions, an access-control or permission editor, forcing a password change on first sign-in, sign-in lockout, or deactivating and deleting accounts — and also whenever they are designing who-can-do-what in a multi-user app, even if they never say "user management".
---

# User Management

A single administrator-only screen listing every account in the organisation, one card
each, with a per-row menu offering **Edit details**, **Reset password** and **Remove
account**.

The full specification is `references/spec.md`. This file is the map.

## The organising idea

**An account is given to you, not claimed by you.** Nobody signs themselves up, nobody
renames themselves, and no administrator can remove the last way back in.

That single sentence generates most of the design: there is no self-registration, so
account creation is a form an administrator fills in; there is no email round-trip, so the
server returns a one-time temporary password to pass on directly; and there is a set of
refusals on the update endpoint that exist purely to keep the organisation reachable.

## Before you start

- **List the real permissions first.** The keys in the spec are placeholders and are almost
  certainly wrong for the app. See *Choosing the permission keys* below — this is the
  decision that shapes the screen, and it is worth making before writing code.
- **Is there an account provisioned from outside the app?** If a setup tool creates the
  first administrator, that account needs the protection in §7.3 rule 3. If nothing outside
  the app provisions accounts, drop that rule rather than inventing one.
- **Does the app have an activity log?** Every successful mutation here writes to it. If
  there is none, decide now whether to build one or accept the gap knowingly.
- **What does the app already use for dialogs, menus and chips?** The spec's prerequisite
  table (§2) lists what this screen needs. Map onto what exists.

## Build order

1. **The permission model, server-side, first.** Everything else depends on it. See
   `../design-foundations/references/permissions.md`, with copy-ready `permissions.js` and
   `permission-labels.js` in that skill's `assets/`.
2. The data model (§4) and the server endpoints (§7), guard rails included.
3. The screen shell and its gating (§5.1–5.2).
4. The user row and its menu (§5.3–5.4).
5. The three flows: create, edit, reset, remove (§6).
6. The lifecycle this sits inside: forced password change on first sign-in, sign-in
   lockout, activity logging (§8).

## Choosing the permission keys

The five keys in the spec are placeholders chosen only to show the shape. Before writing
code, list the handful of actions in the real product that are worth granting or
withholding **per person** — the ones where a reasonable administrator might say "yes for
her, no for him".

A useful test: the action is consequential, hard or impossible to undo, or it exposes
information not everyone should see. Everyday actions that everybody does all day are not
permissions; they are just the app.

Keep the list short. Five to ten is the workable range — past that the editor becomes a
wall of switches nobody reads, and "what can this person do?" stops being answerable at a
glance.

## The rules that matter

**The server owns permissions; the client never recomputes them.** The server sends a plain
`{ [key]: boolean }` map and the UI uses it only to show or hide things. **Hiding a control
is a convenience, never the gate** — every protected route enforces its own permission
independently.

**Re-read the user row on every request.** Do not trust the session token's copy of a
permission. Otherwise revoking access waits for the person's session to expire, and that
delay is the whole reason someone revokes access in a hurry.

**Store overrides, not a full set.** The `permissions` column is a list where a bare key
grants, a `no:`-prefixed key revokes, and anything absent falls back to the role default. A
change to a role default then reaches everyone who was never explicitly overridden.

**There is no third "inherit"/"default" state in the UI.** Every permission reads as Allowed
or Denied for that person. "Default" is a state nobody can look at and know what it actually
means for the person in front of them.

**The guard rails are the feature, not error handling.** Nobody renames themselves, because
a username is how the audit trail identifies you. A non-administrator cannot change their
own name. At least one active administrator must always remain — counted over the *other*
administrators, before any demotion or deactivation. Unknown permission keys are rejected.
Each refusal is in §7.3 with the reason it exists.

**The temporary password is shown once, to the administrator, to pass on directly.** It is
never emailed and never retrievable afterwards. The person is forced to set their own the
first time they sign in.

**Use `COALESCE($n, column)` on the update.** An omitted field is left alone rather than
nulled, so one handler serves a rename, a role change and a permission edit without the
client sending the whole row.

## Accessibility

The shared dialog and control requirements are in
`../design-foundations/references/modal-accessibility.md`. The ones specific to this
screen: each row's menu button names the person (`aria-label="Actions for Priya"`, never a
bare "Actions" repeated down a list), the permission buttons use `aria-pressed` so the pair
reads as one two-state choice, the menu supports arrow keys, Home/End and Escape, and every
status chip carries a word so state never depends on colour alone.

## Reference files

| File | Read it when |
|---|---|
| `references/spec.md` | Building any part of the feature — the complete original specification, including every endpoint, flow and the acceptance checklist. |
| `../design-foundations/references/permissions.md` | Building the permission model. Start here. |
| `../design-foundations/references/modal-accessibility.md` | Building the dialogs, the row menu or the permission editor. |
