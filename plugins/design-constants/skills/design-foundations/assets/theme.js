/**
 * Applying the theme.
 *
 * Call this from the app's ENTRY FILE, before the framework mounts, reading straight from
 * storage. Otherwise the app paints light and then flips — a white flash on every cold
 * start, which is precisely what a dark-mode user is trying to avoid.
 *
 *   // entry file, before render()
 *   applyThemePreference(readThemePreference());
 */

function systemPrefersDark() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function applyThemePreference({ mode, accent }) {
  // "system" is resolved here, so the stylesheet only ever sees light or dark.
  const resolved = mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode;

  document.body.dataset.mode = resolved;
  document.body.dataset.accent = accent;

  // Lets the browser theme its own furniture: form controls, scrollbars, the caret,
  // and the ground behind an over-scrolled page.
  document.documentElement.style.colorScheme = resolved;

  // The browser/OS chrome around the app (Android address bar, iOS status area in
  // standalone mode). Without it the frame stays light while the app goes black, and
  // the seam is very visible.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#000000' : '#f2f3f5');
}

/**
 * If a component genuinely needs the mode in JS (a canvas, a chart, a map), read
 * `document.body.dataset.mode`. Never branch on `prefers-color-scheme` inside a
 * component — that ignores an explicit choice the person made.
 */
export function currentMode() {
  return document.body.dataset.mode === 'dark' ? 'dark' : 'light';
}
