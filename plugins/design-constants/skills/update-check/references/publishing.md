# Publishing releases the update check can find

The app can only offer what CI publishes. This is the release side: naming, the public
releases repository, the token and the signing key.

## Contents

- [Naming](#naming)
- [Public code repository](#public-code-repository)
- [Private code repository: a public releases-only repository](#private-code-repository-a-public-releases-only-repository)
- [Signing: the rule that makes updates install](#signing-the-rule-that-makes-updates-install)
- [Other releases in the same repository](#other-releases-in-the-same-repository)
- [Checking a release went out](#checking-a-release-went-out)

## Naming

Everything derives from `versionName` in `app/build.gradle.kts`:

| Thing | Value |
|---|---|
| Tag | `v<versionName>` |
| Release title | `<App> <versionName>` |
| Asset | `<App>-<versionName>.apk` |
| Marked latest | yes, every app release |

CI reads `versionName` with `sed`, so nobody types the version twice. Publishing the same
version again (a push without a bump) replaces that release's APK with `--clobber`
instead of failing. `versionCode` must go up by one with every release: Android refuses
to install a lower code over a higher one.

If the app also uses the changelog skill, its version check already keeps `versionName`,
the newest changelog entry and the README in step.

## Public code repository

The workflow's own `GITHUB_TOKEN` (with `permissions: contents: write`) can publish to the
same repository. The app's `RELEASES_REPO` is the code repository. Nothing else to set up.

## Private code repository: a public releases-only repository

A private repository's releases can't be read without a token, and a token must never
ship in the app. So CI also publishes each APK to a small public repository that holds
only releases.

One-time setup (write this into the app's own docs, for whoever maintains it):

1. **Create `<owner>/<app>-releases`.** Public, with **Add a README file** ticked (a
   release needs a commit to attach to). The README says what the repository is and
   that each release installs over the previous one.
2. **Create a fine-grained token.** GitHub › Settings › Developer settings › Personal
   access tokens › Fine-grained tokens. Repository access: only `<app>-releases`.
   Permissions: **Contents: Read and write**. Nothing else.
3. **Give it to CI.** In the code repository: Settings › Secrets and variables › Actions
   › New repository secret, named `RELEASES_TOKEN`.
4. **Make the code repository private** if it isn't yet.

The mirror step is skipped while `RELEASES_TOKEN` is empty, so the build still passes and
the app simply finds no updates until the token is set.

**Back-filling.** If the releases repository is created after some versions shipped,
copy the earlier releases over, oldest first and not latest, then publish the current
one last as latest. `assets/release.yml` has a step that does this only when something is
missing.

**Renaming the releases repository** keeps working for apps already installed, because
GitHub redirects the old API path. Still update `RELEASES_REPO` in the next release.

## Signing: the rule that makes updates install

Android installs an update over an existing app only if both are signed with **the same
key**. Get this wrong and every update fails with "App not installed", and the only way
out is to uninstall, which deletes the person's data.

- Sign every release build with one permanent keystore. Configure it in `signingConfigs`
  and use it for `release` (and for `debug` too, if testers install debug builds).
- Where the keystore lives is a project decision. Committing it keeps every build
  installable from any machine or CI run, at the cost that anyone with the repository
  can sign as the app. Storing it as a CI secret (base64) is the stricter choice. Either
  way, **back it up**: losing it means every user has to uninstall.
- Never let CI fall back to a fresh debug key when the keystore is missing; fail the build
  instead.

## Other releases in the same repository

Content that the app downloads separately (sound packs, models, maps) can be published to
the same releases repository, but:

- give it its own tag scheme (`sounds-<version>`), never `v…`;
- publish it with `--latest=false`, so `releases/latest` still means the app;
- publish each content version once and never replace it; the app verifies it by a
  SHA-256 written in the app's code.

## Checking a release went out

After the merge build finishes:

```bash
curl -s https://api.github.com/repos/<owner>/<app>-releases/releases/latest | grep tag_name
```

It should name the new tag. Then make sure the APK downloads, not an error page:

```bash
curl -sL https://github.com/<owner>/<app>-releases/releases/download/v<version>/<App>-<version>.apk -r 0-1 | head -c 2
```

It should print `PK`, the start of every APK.
