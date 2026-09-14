/**
 * Every release entry ever written, newest first.
 *
 * Entries are never edited after they ship and never deleted. This array is the app's
 * release history: someone who skipped four versions should be able to read all four.
 * If a shipped entry turns out to be wrong, the next entry says so.
 *
 * Written for the people who use the app, not for developers. See the house style in
 * references/writing-entries.md before adding one.
 */
import { CURRENT_VERSION } from './version';

export const CHANGELOG = [
  {
    version: '1.0.0',
    title: 'The first release',
    items: [
      'Replace this entry with the first real one. The title is a sentence about what is now true, not a version label.',
      'Two to five items is the useful range. Group small related fixes into one line rather than listing every commit.',
    ],
  },
];

// Dev-only drift warning. This is what makes the two-file split safe: the moment the array
// and the constant disagree, anyone running the app locally sees it.
// Not Vite? Use `process.env.NODE_ENV !== 'production'` instead.
if (import.meta.env.DEV && CHANGELOG[0].version !== CURRENT_VERSION) {
  // eslint-disable-next-line no-console
  console.warn(
    `CHANGELOG[0].version (${CHANGELOG[0].version}) doesn't match CURRENT_VERSION (${CURRENT_VERSION}) — update whichever one is stale.`
  );
}
