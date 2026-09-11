# How to Build the User Management Feature

A complete specification of a **User Management** screen: where an administrator creates
accounts, edits them, resets passwords, sets what each person is allowed to do, and removes
accounts — with the guard rails that stop anyone locking the whole organisation out. Hand
this file to a coding agent working on any app and it should be able to build the feature
end to end.

Nothing here is tied to a particular product or industry. `<App>` stands for your app's
name. The permission keys in §3 are **placeholders you must replace** — see the callout
there. No colours are specified; use the app's own tokens.

---

## 1. What the feature is, in one paragraph

User Management is a single administrator-only screen listing every account in the
organisation, one card each, with a menu on each card offering **Edit details**, **Reset
password** and **Remove account**. New accounts are created here, never self-registered: an
administrator enters a name, a username and a role, and the server hands back a one-time
temporary password to pass on directly. The person is forced to set their own password the
first time they sign in. Each account also carries a per-person permission list, edited from
the same screen, which the server computes and enforces — the client only ever displays the
answer.

The organising idea is that **an account is given to you, not claimed by you**. Nobody signs
themselves up, nobody renames themselves, and no administrator can remove the last way back
in.

---

## 2. Prerequisites in the target app

| Needed | What it must do |
|---|---|
| `TopBar` | Title bar accepting `title`, `subtitle`, a `leading` slot (back button) and a `trailing` slot (an action button). |
| `Card` | A surface; an "elevated" variant is used for each row. |
| `Avatar` | Initials avatar taking `firstName` / `lastName`. |
| `Chip` | Small status pill with variants (primary / neutral / error / warning). |
| `Menu` + `useMenu` | Anchored dropdown taking `{label, icon, onClick, danger}[]`, with arrow-key navigation and Escape to close. |
| `IconButton` | Icon-only button with a required accessible `label`. |
| `Modal` | Dialog with generated-id `aria-labelledby`, Escape/overlay close, focus management. |
| `TextField`, `Select`, `Button`, `Alert`, `Spinner`, `EmptyState` | The usual form and state primitives. `Button` needs `filled` / `outlined` / `text` / `success` / `danger` variants and an `xs` size. |
| `Reveal` | Collapse-until-asked wrapper (used for the permission editor). |
| `confirm()` / `notify()` | Promise-based dialogs. `confirm` takes `{message, confirmLabel, danger}` or a plain string; `notify` shows a message with an OK button. |
| `useApiQuery(path)` | Returns `{data, loading, error, refetch}`. |
| Session context | Must expose `user` (the signed-in person) and `can(permissionKey)`. |
| API client | `get/post/put/delete`, throwing an `Error` whose `message` is the server's error string. |

---

## 3. The permission model — build this first

Everything else depends on it. **The server owns it. The client never recomputes it.**

### 3.1 Defaults by role

One map, on the server, of every grantable permission to a function of the role.

> ### ⚠️ Replace these keys with what your organisation actually does
>
> The five below are **placeholders**, chosen only to show the shape and the
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

### 3.2 Per-person overrides

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

### 3.3 Enforcement

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

### 3.4 What reaches the client

`computePermissionSet` is sent on sign-in and on `/auth/me` as a plain `{ [key]: boolean }`
map. The session context exposes it as `can: (key) => !!session?.user?.permissions?.[key]`,
and the UI uses that only to show or hide things. **Hiding a control is a convenience, never
the gate** — every protected route enforces its own permission independently.

### 3.5 Display labels (the one client-side piece)

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

## 4. Data model

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  username TEXT,
  password_hash TEXT,
  must_change_password BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  failed_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions TEXT[];
```

Notes:

- `must_change_password` **defaults to true** — an account is not usable until its owner has
  chosen their own password.
- `is_active` is how an account is stood down; accounts are deactivated far more often than
  deleted.
- `failed_attempts` and `locked_until` implement the sign-in lockout (§8).
- Usernames are **lowercase only** and compared case-insensitively everywhere. If the unique
  index is case-sensitive, `Ama` and `ama` could exist as two rows that every screen and
  query treats as one — reject mixed case at the point of writing, and normalise existing
  rows in a migration.
- Two roles is usually the right number: `USER` and `ADMIN`. Per-person permissions are what
  handle the cases in between, which is the whole reason they exist.

---

## 5. The screen

### 5.1 Entry and gating

Reached from Settings, as a tile shown **only** when `can('manageUsers')`:

```jsx
{can('manageUsers') && (
  <Tile icon="manage_accounts" label="User Management" onClick={() => navigate('userManage')} />
)}
```

The page itself re-checks, so a direct navigation lands somewhere sensible rather than on an
erroring screen:

```jsx
if (!can('manageUsers')) {
  return (
    <>
      <TopBar title="User Management" leading={<BackButton onClick={back} />} />
      <main className="main-content" id="main-content">
        <Alert variant="error">You do not have permission to manage user accounts.</Alert>
      </main>
    </>
  );
}
```

The API enforces the same permission on every route in the router; this is UI courtesy.

### 5.2 Shell

```jsx
const { data, loading, error, refetch } = useApiQuery(USER_LIST_PATH);
const [modal, setModal] = useState(null); // null | 'create' | userObject (for edit)

<TopBar
  title="User Management"
  subtitle={data ? `${data.users.length} accounts` : undefined}
  leading={<BackButton onClick={back} />}
  trailing={<IconButton icon="person_add" label="Add user account" variant="tonal" onClick={() => setModal('create')} />}
/>
<main className="main-content" id="main-content">
  {loading && <Spinner label="Loading users" />}
  {error && <Alert variant="error">{error}</Alert>}
  {data && data.users.length === 0 && <EmptyState icon="group_off" title="No user accounts yet" />}
  {data?.users.map((u) => (
    <UserRow key={u.id} user={u} isSelf={u.id === me.id} onEdit={() => setModal(u)} onChanged={refetch} />
  ))}
</main>
```

One `modal` state variable carries three cases — closed, creating, or the user object being
edited. Every mutation calls `refetch` on success; the list is never patched locally, so what
is on screen is always what the server just decided.

### 5.3 A user row

An elevated card: avatar, then a stack of identity and status, then the actions menu.

```jsx
<Card variant="elevated" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
  <Avatar firstName={u.first_name} lastName={u.last_name} />
  <div style={{ flex: 1, minWidth: 0 }}>
    <div className="person-name">
      {titleCase(u.first_name)} {titleCase(u.last_name)}
      {isSelf && <span className="muted" style={{ fontWeight: 400 }}> (you)</span>}
    </div>
    <div className="tiny muted mono">@{u.username}</div>
    <div className="person-meta">
      <Chip variant={u.role === 'ADMIN' ? 'primary' : 'neutral'}>
        {u.role === 'ADMIN' ? 'Administrator' : 'User'}
      </Chip>
      {!u.is_active && <Chip variant="error">Inactive</Chip>}
      {locked && <Chip variant="error" className="pulse">Locked</Chip>}
      {u.must_change_password && <Chip variant="warning">Password reset pending</Chip>}
    </div>
    <div className="tiny muted" style={{ marginTop: 4 }}>
      Last sign-in: {u.last_login_at ? formatDateTime(u.last_login_at) : 'Never'}
    </div>
  </div>
  <IconButton icon="more_vert" label={`Actions for ${titleCase(u.first_name)}`} onClick={menu.openMenu} />
  <Menu anchorEl={menu.anchorEl} onClose={menu.closeMenu} items={menuItems} />
</Card>
```

Details that matter:

- **Lock is computed, not stored as a flag:** `u.locked_until && new Date(u.locked_until) > new Date()`.
  A lock that has expired is not a lock.
- The role chip is always present; the other three appear only when true, so a healthy
  account is visually quiet and a problem account is not.
- **"(you)" is marked on your own row** — several actions behave differently there, and the
  person needs to see which row is theirs before they act.
- "Never" is spelled out for an account not yet used; an empty space reads as missing data.
- The menu's icon button carries the person's name in its accessible label — a screen full of
  "more options" buttons is unusable otherwise.

### 5.4 The row menu

```js
const menuItems = [
  { label: 'Edit details',   icon: 'edit',       onClick: onEdit },
  { label: 'Reset password', icon: 'lock_reset', onClick: resetPassword },
];
if (!isSelf) menuItems.push({ label: 'Remove account', icon: 'person_remove', danger: true, onClick: remove });
```

**Remove is absent from your own row**, not merely disabled — an action you may never take
should not be offered. (The server refuses it anyway; see §7.4.)

---

## 6. The three flows

### 6.1 Creating an account

A modal titled **"Add User Account"** (icon `person_add`) with First Name, Last Name,
Username and a Role select (`User` / `Administrator`).

- The username field **lowercases as you type**: `onChange={(v) => setUsername(v.toLowerCase())}`.
  Do not validate-and-scold what you can simply normalise.
- Helper text: *"Lowercase letters, numbers, dots, underscores, hyphens"*.
- Client checks before the request: both names non-empty, then the username against the
  shared username rule.
- **No password field.** The server generates a temporary one.

On success, in this order: close the modal, `notify` the temporary password, then refetch.

```jsx
const d = await createUser({ firstName, lastName, username, role });
onClose();
notify(`Account created for ${firstName} ${lastName} (@${username}).\n\nTemporary password: ${d.temporaryPassword}\n\nShare this with them directly.`);
onCreated();
```

The temporary password is shown **exactly once**, in a dialog the administrator has to
dismiss. It is never emailed, never stored in plaintext, and never retrievable later — if it
is lost, the answer is a reset, which is one menu item away.

### 6.2 Editing an account

A modal titled **"Edit User"** (icon `edit`) with First Name, Last Name, Username, a Role
select, a Status select (`Active` / `Inactive`), and the permission editor.

The permission editor sits behind a `Reveal` labelled **"What they can do"**, whose collapsed
summary is the count: *"{allowed} of {total} things allowed."* Expanded, it explains the model
in one line — *"Every one of these is either allowed or denied for this person. The ones
marked 'usual for everyone' are what an ordinary user has unless you take it away."* — then
one row per permission:

```jsx
<div key={key} className="perm-row">
  <span className="perm-row-label">
    {label}
    {DEFAULT_FOR_EVERYONE.includes(key) && <span className="perm-row-note">usual for everyone</span>}
  </span>
  <div className="perm-row-choice">
    <Button size="xs" variant={state === 'allow' ? 'success' : 'outlined'}
            icon={state === 'allow' ? 'check' : undefined}
            aria-pressed={state === 'allow'} onClick={() => setPerm(key, 'allow')}>Allowed</Button>
    <Button size="xs" variant={state === 'deny' ? 'danger' : 'outlined'}
            icon={state === 'deny' ? 'block' : undefined}
            aria-pressed={state === 'deny'} onClick={() => setPerm(key, 'deny')}>Denied</Button>
  </div>
</div>
```

Write that explanatory line so it does not name a count. "The first four are…" becomes a lie
the moment somebody adds a permission, and nobody remembers to update prose in a modal.

**Initial state comes from the server's computed answer**, never from re-deriving the defaults
in the browser — a second copy of the defaults on the client is exactly the drift this avoids:

```js
function permStateFrom(user, key) {
  return user.effective && user.effective[key] ? 'allow' : 'deny';
}
```

**Saving writes every key out explicitly**, allowed or denied, so nothing is left implied and
the next person to open the screen reads exactly what was decided here:

```js
const permissions = Object.entries(permOverrides).map(([key, state]) =>
  state === 'allow' ? key : `no:${key}`
);
```

A consequence worth understanding before copying this: once saved, that person's permissions
no longer follow the role defaults. Changing their role afterwards will not change what they
can do until someone opens this editor again. That is deliberate — an explicit decision about
a named person outranks a default — but it must be a decision you make knowingly. If you want
the opposite behaviour, write out only the keys that differ from the role default, and accept
that "what does this person have?" becomes a question with a longer answer.

`aria-pressed` on both buttons is what makes the pair readable to a screen reader as a
two-state choice rather than as two unrelated buttons.

### 6.3 Resetting a password

Confirm first, then show the new temporary password once:

```js
if (!(await confirm(`Generate a new temporary password for ${titleCase(u.first_name)}?`))) return;
const d = await resetUserPassword(u.id);
notify(`New temporary password: ${d.temporaryPassword}\n\nShare this with them directly — they'll be asked to set their own password on next sign-in.`);
onChanged();
```

Server-side the reset also **clears the lockout** (`failed_attempts = 0`, `locked_until = NULL`)
— an administrator resetting the password is exactly the intervention a locked-out person
needs, and making them wait out the lock as well helps nobody.

### 6.4 Removing an account

A dangerous confirm — a distinct label and the danger treatment, not a generic OK/Cancel:

```js
const ok = await confirm({
  message: `Remove ${titleCase(u.first_name)} ${titleCase(u.last_name)}'s account? This cannot be undone.`,
  confirmLabel: 'Remove',
  danger: true,
});
```

On failure, surface the server's message with `notify(e.message)` — every refusal below is
written to be read by the administrator who tried it.

Prefer **Inactive** to removal in the product's own guidance: a removed account's audit
history keeps the actor name recorded at the time, but the account itself is gone.

---

## 7. The server

All routes mount under one router with `router.use(requirePermission('manageUsers'))`, so no
individual handler can forget the check.

### 7.1 `GET /users`

```js
const result = await req.db.query(
  'SELECT id, first_name, last_name, role, username, is_active, must_change_password, ' +
  'failed_attempts, locked_until, last_login_at, created_at, permissions FROM users ORDER BY created_at DESC'
);
res.json({ users: result.rows.map((row) => ({ ...row, effective: computePermissionSet(row) })) });
```

`permissions` is the raw override list; **`effective` is what those overrides add up to**,
computed by the same function the server gates on. The editor needs the answer, not the
ingredients. `password_hash` is never selected.

### 7.2 `POST /users`

1. Require first and last name → 400.
2. Validate the username → 400.
3. Reject a duplicate, compared with `lower(username) = lower($1)` → **409**.
4. Coerce the role: `role === 'ADMIN' ? 'ADMIN' : 'USER'` — never write through whatever the
   client sent.
5. Generate a temporary password, bcrypt it (cost 10), insert with
   `must_change_password = true`.
6. Title-case the names on the way in, so the list is consistent however they were typed.
7. Log the creation to the activity log.
8. Respond **201** with the created row **plus `temporaryPassword`** — the only time it ever
   leaves the server.

Temporary password generation, which must satisfy the password policy by construction:

```js
function generateTempPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';  // no i/l/o
  const digits  = '23456789';                                        // no 0/1
  const all = letters + digits;
  let pw = '';
  for (let i = 0; i < 8; i++) pw += all[crypto.randomInt(all.length)];
  pw += letters[crypto.randomInt(letters.length)];   // guarantee both classes
  pw += digits[crypto.randomInt(digits.length)];
  return pw;
}
```

Use a **cryptographic** random source (`crypto.randomInt`), not `Math.random`. The excluded
characters are the ones people misread when a password is written on paper and handed over,
which is exactly how this one travels.

### 7.3 `PUT /users/:id` — the guard rails

This handler is mostly refusals, and each one exists for a reason:

1. **Nobody renames themselves.** A username is how the activity log and every audit trail
   identify you, so it is given to you by someone else and stays put. An administrator can
   still correct someone else's typo. → **403**, *"You cannot change your own username. Ask
   another administrator."*
2. **A non-administrator cannot change their own name** — the person a name belongs to cannot
   quietly become somebody else. → **403**.
3. **A system-provisioned administrator account is protected**, if your product has one: the
   account created when the organisation was set up cannot be deactivated, demoted, renamed or
   removed from inside the app, because it is the way back in if every other administrator is
   locked out. Only the tool that created it can change it. → **403**. Skip this rule if
   nothing outside the app provisions accounts.
4. **Username validity and uniqueness** are re-checked, excluding the row itself → 400 / 409.
5. **Unknown permission keys are rejected**, after stripping the `no:` prefix → 400,
   *"Unknown permission: …"*.
6. **At least one active administrator must remain.** Before any demotion or deactivation of
   an administrator, count the *other* active administrators; zero → **400**.

```js
if ((role && role !== 'ADMIN') || isActive === false) {
  if (existing.rows[0].role === 'ADMIN') {
    const admins = await req.db.query(
      "SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND is_active = true AND id != $1", [req.params.id]
    );
    if (parseInt(admins.rows[0].count) === 0) {
      return res.status(400).json({ error: 'At least one active administrator must remain' });
    }
  }
}
```

The update itself uses `COALESCE($n, column)` for every field, so an omitted field is left
alone rather than nulled — the same handler serves a rename, a role change and a permission
edit without the client having to send the whole row.

Every successful update is written to the activity log.

### 7.4 `POST /users/:id/reset-password` and `DELETE /users/:id`

Reset: generate, hash, and
`UPDATE users SET password_hash = $1, must_change_password = true, failed_attempts = 0, locked_until = NULL`,
log it, return `{ temporaryPassword }`.

Delete, in order:

1. **You cannot remove your own account** → 400. (The last-administrator guard below would not
   catch this when other administrators exist.)
2. Missing row → 404.
3. System-provisioned account → 403.
4. **Last active administrator** → 400, same message and same count query as above.
5. Delete, and log it.

### 7.5 Client service

```js
export const USER_LIST_PATH = '/users';
export const createUser        = (payload)   => api.post('/users', payload);
export const updateUser        = (id, body)  => api.put(`/users/${id}`, body);
export const resetUserPassword = (id)        => api.post(`/users/${id}/reset-password`, {});
export const removeUser        = (id)        => api.delete(`/users/${id}`);
```

---

## 8. The account lifecycle this screen sits inside

User Management is only half the feature; these three pieces complete it.

### 8.1 Forced password change on first sign-in

When the session reports `mustChangePassword`, the app renders a **full-screen page instead
of the app shell** — not a dismissible dialog. There is deliberately no "skip": the temporary
password was shown to an administrator once and shared directly, so it must not remain valid
indefinitely.

The page asks for a new password twice, sends **no current password** (the server skips that
check precisely when `must_change_password` is true), and offers "Sign out instead" as the
only way past it. On success it clears the flag in the session and the app shell appears.

### 8.2 Sign-in lockout

- Wrong password: increment `failed_attempts`; at **5**, set `locked_until` to 15 minutes out.
  Respond 401, with *"Too many attempts. Account locked for 15 minutes."* on the attempt that
  trips it.
- A subsequent attempt while locked → **423**, *"Account locked after too many attempts.
  Contact an administrator."*
- A successful sign-in clears both counters and stamps `last_login_at`.
- An unknown username, an inactive account and a wrong password all return the **same**
  message. To stop the *clock* revealing what the words do not, compare against a decoy hash
  on the miss path so a non-existent username costs the same ~80ms bcrypt does:

```js
let decoyHash = null;
async function compareAgainstDecoy(password) {
  if (!decoyHash) decoyHash = bcrypt.hashSync('there-is-no-account-with-this-password', 10);
  await bcrypt.compare(typeof password === 'string' ? password : '', decoyHash);
}
```

Without it, an unknown username returns in about a millisecond while a real one takes the
~80ms bcrypt deliberately costs. That difference is readable over the network, which turns
any sign-in form into a way of discovering who has an account.

### 8.3 Activity logging

Create, update, password reset and delete each write an activity-log row recording the actor,
the action, the entity and the details. Account administration is exactly the kind of change
people need to be able to reconstruct later.

---

## 9. Structural CSS

Structure only; colours come from the app's tokens.

```css
.perm-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--outline-variant); flex-wrap: wrap; }
.perm-row:last-of-type { border-bottom: none; }
.perm-row-label { flex: 1; min-width: 150px; font-size: .82rem; display: flex; flex-direction: column; gap: 2px; }
.perm-row-note { font-size: .66rem; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; color: var(--on-surface-variant); }
.perm-row-choice { display: flex; gap: 6px; flex-shrink: 0; }

/* Status chips wrap under the name rather than truncating it. */
.person-meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 7px; }

/* Draws the eye to a locked account; disabled under reduced-motion. */
.pulse { animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .55 } }
@media (prefers-reduced-motion: reduce) { .pulse { animation: none } }
```

`flex-wrap` on `.perm-row` is what lets the Allowed/Denied pair drop below a long label on a
narrow phone instead of squeezing it.

---

## 10. Accessibility requirements

- Each row's menu button names the person: ``label={`Actions for ${firstName}`}``.
- The permission buttons use `aria-pressed` so the pair reads as one two-state choice.
- The `Reveal` toggle carries `aria-expanded`.
- Error alerts use `role="alert"`; the dialogs manage focus and close on Escape.
- Status is never conveyed by colour alone — every chip carries a word.
- The menu supports arrow keys, Home/End and Escape.

---

## 11. Acceptance checklist

- [ ] The permission list has been replaced with actions that reflect what this organisation actually does.
- [ ] The User Management tile is hidden for anyone without `manageUsers`, and the screen refuses them if reached directly.
- [ ] Every user route returns 403 to a non-permitted caller regardless of what the UI shows.
- [ ] The list shows role, inactive, locked and password-reset-pending states, and "Never" for an unused account.
- [ ] A lock that has expired no longer shows as locked.
- [ ] Your own row is marked "(you)" and offers no Remove action.
- [ ] Creating an account requires no password field and returns a temporary password shown exactly once.
- [ ] Usernames lowercase as you type; a duplicate (in any case) is refused with 409 and a readable message.
- [ ] The permission editor opens showing the server's effective answer for that person, with no third state.
- [ ] Saving writes every permission explicitly, and reopening the editor shows exactly what was saved.
- [ ] An unknown permission key is rejected by the server.
- [ ] An administrator cannot rename themselves; a non-administrator cannot rename themselves at all.
- [ ] Demoting, deactivating or deleting the last active administrator is refused with a readable message.
- [ ] An administrator cannot delete their own account.
- [ ] Resetting a password clears the lockout and forces a change at next sign-in.
- [ ] A person with `must_change_password` sees the full-screen change form and cannot skip past it.
- [ ] Five wrong passwords lock the account for 15 minutes; a successful sign-in clears the counters.
- [ ] Unknown username, inactive account and wrong password are indistinguishable in both message and timing.
- [ ] Create, update, reset and delete each appear in the activity log with the acting administrator named.
- [ ] Every mutation refetches the list rather than patching it locally.

---

## 12. File manifest

A reference layout. Map it onto whatever structure the target app uses.

| File | Role |
|---|---|
| `src/pages/UserManagePage.jsx` | The screen: list, row, create modal, edit modal, permission editor. |
| `src/services/userService.js` | The four API calls. |
| `src/lib/permissions.js` | `PERMISSION_LABELS`, `DEFAULT_FOR_EVERYONE`, role labels. |
| `src/lib/validation.js` | `validateUsername` (client copy). |
| `src/pages/ForceChangePasswordPage.jsx` | The full-screen first-sign-in password change. |
| `src/context/SessionContext.jsx` | `can(key)` from the server's computed permission map. |
| `server/routes/users.js` | List, create, update, reset, delete — and every guard rail. |
| `server/middleware/permissions.js` | Defaults, `hasPermission`, `computePermissionSet`, `requirePermission`. |
| `server/lib/security.js` | `validateUsername`, `generateTempPassword`, the decoy hash. |
| `server/routes/auth.js` | Sign-in, lockout, and the forced-change path. |
| `server/lib/activityLog.js` | The audit trail every mutation writes to. |
| `server/db/schema.js` | The `users` table and its `permissions TEXT[]` column. |
