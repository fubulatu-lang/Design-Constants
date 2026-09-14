/**
 * The permission model. Server-side.
 *
 * The server owns this and the client never recomputes it. Hiding a control in the UI is
 * a convenience, never the gate — every protected route enforces its own permission.
 *
 * ---------------------------------------------------------------------------
 * EVERY KEY BELOW IS A PLACEHOLDER. Replace them with the handful of actions in
 * your app that are worth granting or withholding PER PERSON — the ones where a
 * reasonable administrator might say "yes for her, no for him".
 *
 * A useful test for whether an action belongs here: it is consequential, hard or
 * impossible to undo, or it exposes information not everyone should see.
 * Everyday actions that everybody does all day are not permissions; they are just
 * the app.
 *
 * Keep the list short. Five to ten is the workable range — past that the editor
 * becomes a wall of switches nobody reads, and "what can this person do?" stops
 * being answerable at a glance.
 * ---------------------------------------------------------------------------
 */

const PERMISSION_DEFAULTS = {
  // What an ordinary user has unless somebody takes it away
  editRecords:     () => true,
  exportRecords:   () => true,

  // Administrators only
  deleteRecords:   (role) => role === 'ADMIN',
  manageUsers:     (role) => role === 'ADMIN',
  viewActivityLog: (role) => role === 'ADMIN',
};

/**
 * The user row carries `permissions TEXT[]` — an OVERRIDE LIST, not a full set.
 * A bare key grants, a `no:`-prefixed key revokes, anything absent falls back to the
 * role default. Storing overrides rather than a full set means a change to a role
 * default reaches everyone who was never explicitly overridden.
 */
export function hasPermission(userRow, key) {
  const overrides = Array.isArray(userRow.permissions) ? userRow.permissions : [];
  if (overrides.includes(key)) return true;
  if (overrides.includes(`no:${key}`)) return false;
  return PERMISSION_DEFAULTS[key] ? PERMISSION_DEFAULTS[key](userRow.role) : false;
}

export function computePermissionSet(userRow) {
  const out = {};
  for (const key of Object.keys(PERMISSION_DEFAULTS)) out[key] = hasPermission(userRow, key);
  return out;
}

/**
 * Enforcement middleware. Re-reads the user row on EVERY request rather than trusting the
 * session token, so a permission change takes effect immediately instead of waiting for
 * the person's session to expire. That delay is the whole reason someone revokes a
 * permission in a hurry.
 */
export function createRequirePermission() {
  return function requirePermission(key) {
    return async (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: 'Sign in required' });

      const result = await req.db.query(
        'SELECT role, permissions FROM users WHERE id = $1',
        [req.user.id]
      );
      const row = result.rows[0];

      if (!row || !hasPermission(row, key)) {
        return res.status(403).json({ error: 'You do not have permission to do that' });
      }
      next();
    };
  };
}
