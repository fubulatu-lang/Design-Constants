# The permission model

Build this before any screen that grants, withholds or reacts to a permission — everything
else depends on it.

> Extracted from the User Management specification, where this model is what the permission
> editor writes to. It is reproduced here because any screen that shows or hides a control
> by role is reading the same answer. The copy-ready file is `../assets/permissions.js`.

**The server owns it. The client never recomputes it.**

## Contents

- [Defaults by role](#defaults-by-role)
- [Per-person overrides](#per-person-overrides)
- [Enforcement](#enforcement)
- [What reaches the client](#what-reaches-the-client)
- [Display labels (the one client-side piece)](#display-labels-the-one-client-side-piece)

---

## Defaults by role

One map, on the server, of every grantable permission to a function of the role.

> ### ⚠️ Replace these keys with what your organisation actually does
>
> The five keys below are **placeholders**, chosen only to show the shape and the
> everyone/administrator split. They are almost certainly wrong for your app. Before
> writing any of the code that follows, sit down with the real product and list the
> handful of actions that are worth granting or withholding **per person** — the ones
> where a reasonable administrator might say "yes for her, no for him".
>
> A useful test for whether an action belongs on this list: it is consequential, hard or
> impossible to undo, or it exposes information not everyone should see. Everyday actions
> that everybody does all day are not permissions; they are just the app.
>
> Keep the list short. Five to ten is the workable range — past that the editor becomes a
> wall of switches nobody reads, and the answer to "what can this person do?" stops being
> knowable at a glance.

```js
// PLACEHOLDERS — replace every key here with your own app's actions.
const PERMISSION_DEFAULTS = {
  // What an ordinary user has unless somebody takes it away
  editRecords:      () => true,
  exportRecords:    () => true,

  // Administrators only
  deleteRecords:    (role) => role === 'ADMIN',
  manageUsers:      (role) => role === 'ADMIN',
  viewActivityLog:  (role) => role === 'ADMIN',
};
```

Keep the shape whatever your keys turn out to be: a flat map, role-derived defaults, and the
split between "everyone has this" and "administrators only" as the whole story.

## Per-person overrides

The user row carries a **`permissions TEXT[]`** column — an *override list*, not a full set.
A bare key grants; a `no:`-prefixed key revokes; anything absent falls back to the role
default:

```js
function hasPermission(userRow, key) {
  if (Array.isArray(userRow.permissions) && userRow.permissions.includes(key)) return true;
  if (Array.isArray(userRow.permissions) && userRow.permissions.includes(`no:${key}`)) return false;
  return PERMISSION_DEFAULTS[key] ? PERMISSION_DEFAULTS[key](userRow.role) : false;
}

function computePermissionSet(userRow) {
  const out = {};
  for (const key of Object.keys(PERMISSION_DEFAULTS)) out[key] = hasPermission(userRow, key);
  return out;
}
```

## Enforcement

A middleware factory that **re-reads the user row on every request** rather than trusting the
session token, so a permission change takes effect immediately instead of waiting for the
person's session to expire:

```js
function createRequirePermission() {
  return function requirePermission(key) {
    return async (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: 'Sign in required' });
      const result = await req.db.query('SELECT role, permissions FROM users WHERE id = $1', [req.user.id]);
      const row = result.rows[0];
      if (!row || !hasPermission(row, key)) {
        return res.status(403).json({ error: 'You do not have permission to do that' });
      }
      next();
    };
  };
}
```

## What reaches the client

`computePermissionSet` is sent on sign-in and on `/auth/me` as a plain `{ [key]: boolean }`
map. The session context exposes it as `can: (key) => !!session?.user?.permissions?.[key]`,
and the UI uses that only to show or hide things. **Hiding a control is a convenience, never
the gate** — every protected route enforces its own permission independently.

## Display labels (the one client-side piece)

A single ordered map of key → human label, shared by the permission editor and by any "your
access" summary elsewhere, so two screens never describe the same permission two different
ways:

```js
// Labels for the placeholder keys above — replace alongside them.
export const PERMISSION_LABELS = {
  editRecords:     'Edit Records',
  exportRecords:   'Export Records',
  deleteRecords:   'Permanently Delete Records',
  manageUsers:     'Manage User Accounts',
  viewActivityLog: 'View Activity Log',
};

/** The ones an ordinary user has unless somebody takes them away.
 *  Used only to explain the split on screen — the server decides. */
export const DEFAULT_FOR_EVERYONE = ['editRecords', 'exportRecords'];
```

Order matters: the everyone-by-default keys come first, so the screen reads as "the ordinary
ones, then the administrator ones".

**There is no third "inherit"/"default" state in the UI.** Every permission reads as Allowed
or Denied for that person. "Default" is a state nobody can look at and know what it actually
means for the person in front of them.

---

