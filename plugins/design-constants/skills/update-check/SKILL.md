---
name: update-check
description: Build an in-app update check for an app installed outside an app store, such as a sideloaded Android APK. The app asks a public GitHub releases page for the newest version each time it opens, offers it once per start with Update and Ignore, downloads it with a progress bar and hands it to the system installer. Settings gets a "Check for updates" row. CI publishes every release (to a public releases-only repository when the code is private). Use this whenever the user mentions an update check, auto-update, "tell people a new version is out", in-app updates, self-updating APKs, sideloading, distributing an app through GitHub Releases, a public downloads repository, or "how do players get the new version", even if they never say "update check".
---

# In-app update check

An app installed from a file has no store to update it. This feature closes the loop:
CI publishes each release to a public place, and the app checks that place each time it
opens, says when something newer exists, and installs it in two taps, keeping
everything the person has set up.

The full specification is `references/spec.md`. Publishing (CI, the public releases
repository, the token, signing) is `references/publishing.md`. This file is the map.

## Before you start

Read the target app first and answer these, because they change what you write:

- **Is the app in a store?** If it ships through Google Play or the App Store, **do not
  build this.** Play's policy forbids apps from installing their own APKs, and the store
  already updates the app. Use Play's In-App Updates API instead. This skill is for apps
  installed from a file or a website.
- **Is the code repository public?** If it is, the app can ask the code repository's own
  releases. If it is private, the app cannot read it without a token, and **a token must
  never ship inside an app**. Publish to a small public repository that holds only
  releases (see `references/publishing.md`).
- **Is the signing key fixed?** An update installs over the old version only if both are
  signed with the same key. If CI signs with a throwaway debug key, fix that first, or
  every "update" will fail to install.
- **What else is published as a release?** Anything that is not the app, such as content
  packs, must be published as "not latest", or the update check will offer it.
- **What does the app already have?** Reuse its dialog, its download helper, its storage
  (SharedPreferences, DataStore) and its Settings row component.

## Build order

1. CI: name the build `<App>-<version>.apk` and publish it as release `v<version>`, marked
   latest. Mirror it to the public releases repository if the code is private.
2. `Updates.kt`: ask `releases/latest`, read the tag and the APK asset, compare versions.
3. The check in the view model: on every open, plus a manual check.
4. `UpdateDialog`: offers the update once per start, with Update and Ignore.
5. The download: HTTPS only, size-capped, with progress. Then the system installer through
   a FileProvider.
6. The Settings row: current version, last result, and "Check for updates" or "Update to X".

Copy-ready Kotlin and Jetpack Compose files for all of these are in `assets/`, with a
GitHub Actions workflow.

## The rules that matter

**Never put a token in the app.** Anything shipped in an APK can be read by anyone who
has it. The app reads a public endpoint without authentication, or nothing at all.

**Send nothing about the person.** The request is a plain GET of a public URL with a
User-Agent naming the app. Say so in Settings: "Nothing about you or your phone is sent."

**Compare versions numerically, MAJOR.MINOR.PATCH.** This is the one place where order
matters. A newer version is offered, and an older or equal one never is. Strip a leading
`v` and anything after `-`; `0.10.0` is newer than `0.9.0`. (The changelog gate compares
by equality; this check is a different question.)

**Check every time the app opens, silently.** No toast, no spinner on the main screen.
Offline, fall back to the last answer saved, so a known update is still offered on a
plane.

**Ask once per start, and respect Ignore per version.** Ignore stores that version and
stops the automatic prompt for it. The next version asks again. A manual "Check for
updates" always asks, even about an ignored version.

**Never stack the prompt on a first-run flow.** Hold it while onboarding, a tour or a
permission screen is showing. It can wait for the next start.

**Answer "will I lose anything?" in the dialog.** Name what is kept (settings, data) and
the download size. Update and Ignore are the two buttons. Back closes it and it asks again
next start. While downloading, the dialog cannot be dismissed and shows a percentage.

**Download defensively.** HTTPS only, and check every redirect (GitHub redirects to its
file server). Cap the size, delete the partial file on any failure, and give the person a
sentence they can act on, not a stack trace.

**Hand over through a narrow FileProvider path.** Expose only the update folder in the
cache, not the whole cache or files directory. Declare `REQUEST_INSTALL_PACKAGES`. The
first time, Android asks the person to allow installs from this app; that is expected.

**Only the app is "latest".** CI marks every app release latest and every other release
(content packs, betas) not latest, so `releases/latest` always means the newest app.

**The version comes from one place.** The tag, the APK name and the in-app version all
derive from the build file's `versionName`. Also bump `versionCode` every release:
Android refuses to install a lower code over a higher one.

## Adapting to the stack

The rules above are stack-neutral. The reference code is Android (Kotlin, Jetpack
Compose, `HttpURLConnection`, `org.json`).

| Reference code | Elsewhere |
|---|---|
| `HttpURLConnection` + `org.json` | OkHttp/Retrofit, or Ktor: same request, same fields. |
| `ViewModel` + `mutableStateOf` | Views: LiveData or StateFlow with the same semantics. |
| `SharedPreferences` | DataStore: the same keys; reads are async. |
| FileProvider + `ACTION_VIEW` with the APK MIME type | Android 8+: also works with `PackageInstaller` sessions, if you need silent progress. |
| Electron (desktop) | `electron-updater` against the same GitHub releases. The rules still apply: no token, ask, keep data. |
| Web app or PWA | Not needed: a reload is the update. Use the changelog skill to say what changed. |

## Pairs with

- **changelog**: after an update installs, the What's New popup tells the person what
  changed. Ship both.
- **design-foundations**: the dialog follows `../design-foundations/references/modal-accessibility.md`.

## Reference files

| File | Read it when |
|---|---|
| `references/spec.md` | Building the feature: the complete specification and the acceptance checklist. |
| `references/publishing.md` | Setting up CI, the public releases repository, the token and signing. |
| `assets/Updates.kt` | The GitHub request and the version comparison. |
| `assets/UpdateController.kt` | The check, the prompt rules, Ignore and the install, as view-model code. |
| `assets/Net.kt` | The defensive download. |
| `assets/UpdateUi.kt` | The dialog and the Settings row (Compose). |
| `assets/AndroidManifest.snippet.xml`, `assets/file_paths.xml` | The permission and the FileProvider. |
| `assets/release.yml` | The GitHub Actions workflow that names, publishes and mirrors each release. |
