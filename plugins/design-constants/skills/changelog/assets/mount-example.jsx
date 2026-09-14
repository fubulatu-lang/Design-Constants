/**
 * How the two entry points are wired. Not a file to copy wholesale — the two halves belong
 * in the app shell and the Settings page respectively.
 *
 * Both lazy-load the modal for the same reason the version constant lives in its own
 * module: the changelog array should only ever load when somebody actually asks for it.
 * The Suspense fallback is `null` on purpose, so a slow chunk never flashes a spinner
 * over the app.
 */
import { lazy, Suspense, useState } from 'react';
import { useChangelogGate } from './hooks/useChangelogGate';
import { CURRENT_VERSION } from './lib/version';

const ChangelogModal = lazy(() =>
  import('./components/ChangelogModal').then((m) => ({ default: m.ChangelogModal }))
);

/* ------------------------------------------------------------------ *
 * 1. The app shell — mounted ONCE, at the top level.
 *    Inside a page it would remount on every navigation and reappear.
 * ------------------------------------------------------------------ */
export function AppShellChangelog({ user }) {
  const changelogGate = useChangelogGate(user?.id);

  // If a second app (an admin tool, say) shares this browser origin, namespace the id:
  //   useChangelogGate(admin?.id ? `admin:${admin.id}` : null)
  // Without the prefix, two unrelated people whose ids collide across separate databases
  // would answer the popup for each other.

  return changelogGate.show ? (
    <Suspense fallback={null}>
      <ChangelogModal onClose={changelogGate.dismiss} />
    </Suspense>
  ) : null;
}

/* ------------------------------------------------------------------ *
 * 2. The Settings screen — the last thing on the page, after every
 *    actual setting. It reads as a quiet closing note about the app
 *    itself, not as a setting. Always opens, whatever has been seen.
 * ------------------------------------------------------------------ */
export function SettingsVersionLink({ appName, feedback }) {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <>
      <button
        type="button"
        className="version-link"
        onClick={() => {
          feedback?.();
          setShowChangelog(true);
        }}
      >
        {appName} v{CURRENT_VERSION} — What's New
      </button>

      {showChangelog && (
        <Suspense fallback={null}>
          <ChangelogModal onClose={() => setShowChangelog(false)} />
        </Suspense>
      )}
    </>
  );
}
