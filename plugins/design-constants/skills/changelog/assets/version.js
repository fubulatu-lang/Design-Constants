/**
 * Just the current version number, in its own tiny module so pages that only need to
 * display it don't pull in the full changelog history.
 *
 * Must match CHANGELOG[0].version. A dev-mode console warning in changelog.js catches it
 * if the two drift apart; scripts/check-version.mjs is the hard stop at build time.
 *
 * Do not be tempted to derive this from CHANGELOG[0].version — that import is exactly
 * what this file exists to avoid.
 */
export const CURRENT_VERSION = '1.0.0';
