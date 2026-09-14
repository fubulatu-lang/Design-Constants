/**
 * Decides whether the "What's New" dialog opens by itself. Once per person, per version.
 *
 * Design decisions worth keeping, all of which have a failure mode behind them:
 *
 *  - Keyed by USER ID, not by device. Devices get shared; a device-wide key would show
 *    the popup to whoever opened the app next and skip it for the person who has not
 *    seen it.
 *  - Compared by EQUALITY, not ordering. The stored value is the version that was seen;
 *    anything else means show it. No version parsing, and a rollback still behaves.
 *  - Inert until there is a user id, so nothing fires while signed out.
 *  - Storage failures are swallowed in both directions. A private window degrades to
 *    "shows each session" rather than crashing the app over a changelog.
 *  - This governs ONLY the automatic popup. The Settings link always opens the dialog.
 *
 * Replace `<app>` with the app's storage prefix.
 */
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
    try {
      localStorage.setItem(storageKey(userId), CURRENT_VERSION);
    } catch {
      /* best-effort */
    }
  }

  return { show, dismiss };
}
