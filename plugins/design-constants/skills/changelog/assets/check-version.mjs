/**
 * Fails the build when the app's version number disagrees with itself.
 *
 * The version is stated in files that cannot import each other — a package-manager field,
 * a server constant in a different module system, a client constant, the changelog, the
 * README, a static guide page. These WILL drift if the only thing stopping them is
 * somebody remembering, so this runs as part of `npm run build`, not as a script someone
 * has to invoke.
 *
 * Deliberately regex-based over the raw file text: no build step, no dependency, and it
 * behaves identically from the package scripts, from CI, or by hand.
 *
 * ---------------------------------------------------------------------------
 * EDIT THE `sources` LIST BELOW to match the target app. Drop the rows it does
 * not have, add any place it states a version that is not listed. A source that
 * is missing from this list is a source that will silently go stale.
 * ---------------------------------------------------------------------------
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function extract(label, file, re) {
  const match = read(file).match(re);
  return { label, file, version: match ? match[1] : null };
}

const sources = [
  extract('package.json "version"', 'package.json',         /"version":\s*"([^"]+)"/),
  extract('APP_VERSION',            'server/config.js',     /APP_VERSION\s*=\s*'([^']+)'/),
  extract('CURRENT_VERSION',        'src/lib/version.js',   /CURRENT_VERSION\s*=\s*'([^']+)'/),
  extract('CHANGELOG[0].version',   'src/lib/changelog.js', /version:\s*'([^']+)'/),
  extract('README title',           'README.md',            /^#\s+\S+\s+v([^\s]+)\s*$/m),
  extract('guide version',          'public/guide.html',    /data-guide-version="([^"]+)"/),
];

const unreadable = sources.filter((s) => s.version === null);
if (unreadable.length) {
  console.error('Version check failed — could not find a version in:');
  for (const s of unreadable) console.error(`  ${s.file} (${s.label})`);
  console.error('\nThe file moved or its format changed; update this script to match.');
  process.exit(1);
}

const versions = [...new Set(sources.map((s) => s.version))];
if (versions.length > 1) {
  console.error('Version check failed — the app version disagrees with itself:\n');
  for (const s of sources) console.error(`  ${s.version.padEnd(10)} ${s.file} (${s.label})`);
  console.error('\nBump every one of the above to the same version. A new release also needs');
  console.error('a matching entry at the top of the changelog and a matching README section.');
  process.exit(1);
}

console.log(`Version check passed — v${versions[0]} in all ${sources.length} places.`);
