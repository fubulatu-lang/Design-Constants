# How to Build the In-App Update Check

A complete specification of an update check for an app installed outside an app store:
where releases are published, how the app finds the newest one, when and how it asks,
how it downloads and installs, and what Settings shows. Hand this file to a coding agent
working on any sideloaded Android app and it should be able to build the feature end to
end.

Nothing here is tied to a particular product. `<App>` stands for the app's name,
`<owner>` for the GitHub account and `<app>-releases` for the public releases
repository. Replace them throughout. No colours are specified; use the app's own tokens.

The reference implementation is DrumTrig, a live drum-trigger app. Its code lives in a
private repository and its APKs in a public one.

---

## Contents

- [1. What the feature is](#1-what-the-feature-is)
- [2. The pieces](#2-the-pieces)
- [3. Where releases live](#3-where-releases-live)
- [4. `Updates.kt`: asking for the newest release](#4-updateskt-asking-for-the-newest-release)
- [5. The check: when it runs and what it remembers](#5-the-check-when-it-runs-and-what-it-remembers)
- [6. The prompt: once per start, Ignore per version](#6-the-prompt-once-per-start-ignore-per-version)
- [7. Downloading and installing](#7-downloading-and-installing)
- [8. The Settings row](#8-the-settings-row)
- [9. Copy](#9-copy)
- [10. Privacy and security](#10-privacy-and-security)
- [11. Acceptance checklist](#11-acceptance-checklist)
- [12. File manifest](#12-file-manifest)

---

## 1. What the feature is

- **Every time the app opens**, it asks GitHub for the newest release in the background.
  Nothing appears unless something newer exists.
- **When a newer version exists**, a dialog asks once per start: "<App> 1.4.0 is
  available", with **Update** and **Ignore**.
- **Update** downloads the APK with a percentage, then opens Android's installer. The new
  version is signed with the same key, so it installs over the old one and keeps every
  setting and file.
- **Ignore** stops the automatic prompt for that version. The next version asks again.
- **Settings › About** always shows the installed version, what the last check found, and
  a button: "Check for updates", or "Update to 1.4.0" once one is known.

## 2. The pieces

| Piece | Job |
|---|---|
| CI workflow | Names the APK `<App>-<version>.apk`, publishes release `v<version>` marked latest, mirrors it to the public repository. |
| `Updates.kt` | One blocking function, `latest()`, plus `isNewer(a, b)`. No state. |
| View-model code (`UpdateController.kt`) | `checkForUpdates(manual)`, `maybePromptUpdate()`, `ignoreUpdate()`, `installUpdate()`, and the observable state. |
| `Net.kt` | `download(url, dest, maxBytes, expectBytes, what, progress)`: HTTPS-only, redirect-checked, size-capped. |
| `UpdateDialog` | The prompt. |
| Settings row | Version, status line, action button. |
| Manifest + `file_paths.xml` | `REQUEST_INSTALL_PACKAGES`, and a FileProvider exposing only `cache/update/`. |

## 3. Where releases live

The app reads `https://api.github.com/repos/<owner>/<repo>/releases/latest`.

- **Public code repository:** `<repo>` is the code repository itself.
- **Private code repository:** `<repo>` is `<app>-releases`, a public repository that
  holds only releases. CI publishes to both. See `publishing.md`.

`releases/latest` returns the newest release that is not a draft, not a prerelease and
marked latest. So:

- Every app release is published with `--latest`.
- Everything else published as a release (content packs, sound packs, test builds) is
  published with `--latest=false`. Otherwise the app would offer a content pack as an
  update.
- Tags are `v<versionName>` and the asset is `<App>-<versionName>.apk`, exactly. The app
  falls back to building that URL itself if the asset list is missing.

## 4. `Updates.kt`: asking for the newest release

```kotlin
class Release(val version: String, val page: String, val apk: String, val apkBytes: Long)
fun latest(): Release?          // null: unreachable, no release, or not 200
fun isNewer(latest: String, current: String): Boolean
```

**Request:** GET, `Accept: application/vnd.github+json`, `User-Agent: <App>`, 8-second
connect and read timeouts. No other headers, no query string, no token.

**Response fields used:**

| Field | Use |
|---|---|
| `tag_name` | The version, with the leading `v` removed. Blank means no release: return null. |
| `html_url` | The release page, for a "download it yourself" fallback. |
| `assets[]` | The first whose `name` ends in `.apk`: its `browser_download_url` and `size`. |

**Unauthenticated limits:** GitHub allows 60 unauthenticated API requests an hour per IP.
One per app start is far inside that. A 403 or 429 is treated like being offline.

**`isNewer`:** split each version on `.` after removing a leading `v` and anything from
the first `-`. Pad to three parts, read non-numbers as 0, and compare part by part.
`isNewer("v0.10.0", "0.9.3")` is true; `isNewer("1.0.0", "1.0.0")` is false.

Call `latest()` off the main thread.

## 5. The check: when it runs and what it remembers

`checkForUpdates(manual: Boolean)`:

1. If a check is already running, return.
2. On a background dispatcher, call `latest()`.
3. **Null (unreachable):**
   - Status: "Couldn't reach GitHub. Check your connection and try again."
   - Manual: show a short message, "Couldn't check for updates."
   - Automatic: use the saved answer. If the saved version is newer than the current
     one, restore it as the known update and apply the prompt rule (§6). This is what
     keeps an update offered when the app opens offline.
4. **A release:** save `updateFound`, `updatePage`, `updateApk`, `updateApkBytes` and
   `updateCheckedAt`.
   - Newer: the known update becomes this release. Status: "<App> X is available. You
     have Y." Manual: open the prompt (even if ignored). Automatic: apply the prompt rule.
   - Not newer: clear the known update. Status: "You have the newest version, Y." Manual:
     "<App> is up to date."

**When it runs:** once from the view model's `init`, so once per process start, and
whenever "Check for updates" is tapped. It does not run on a timer. In tests, skip the
automatic call (DrumTrig checks `Build.FINGERPRINT != "robolectric"`).

**Observable state:** `update: Release?`, `updateStatus: String?` (null until the first
check), `updateChecking: Boolean`, `updatePrompt: Boolean`, `updateProgress: Float?`
(0..1 while downloading, else null).

## 6. The prompt: once per start, Ignore per version

- **Prompt rule** (`maybePromptUpdate`): if there is a known update and its version is
  not the stored `updateIgnored`, set `updatePrompt = true`.
- **Show it** only while no first-run flow is on screen (onboarding, a tour, a permission
  screen). It stays pending and appears as soon as that closes. If the session ends
  first, the next start asks again.
- **Update:** starts the download (§7). The dialog stays, shows a percentage, and its
  buttons and dismissal are disabled until the download ends.
- **Ignore:** store `updateIgnored = <version>` and close. Settings still offers the
  update.
- **Back or tapping outside:** close for this start only. Nothing is stored.
- **Manual check:** opens the prompt for a newer version even if it was ignored.

The stored Ignore value is compared **by equality** with the offered version: a later
version is never ignored automatically.

## 7. Downloading and installing

`installUpdate()`:

1. If a download is running, return. Set `updateProgress = 0`.
2. Clear and recreate `cacheDir/update/`. Download to `update/<App>-<version>.apk` with
   `Net.download`:
   - HTTPS only, for the first URL and every redirect. Follow at most five redirects by
     hand (`instanceFollowRedirects = false`), so none can switch to HTTP.
   - 15-second connect and 30-second read timeouts.
   - Stop and delete past a hard cap (DrumTrig: 200 MB).
   - Progress: bytes received over `Content-Length`, or over the asset's `size` when the
     server omits it, clamped to 0..1.
   - On any failure, delete the partial file and throw a message the person can act on:
     "Couldn't download the update. Check your connection and try again."
3. Get a content URI with `FileProvider.getUriForFile(ctx, "<applicationId>.files", apk)`.
4. Start `ACTION_VIEW` with the MIME type `application/vnd.android.package-archive`,
   `FLAG_GRANT_READ_URI_PERMISSION` and `FLAG_ACTIVITY_NEW_TASK`. Close the prompt.
5. If the installer can't be opened: "Couldn't open Android's installer. Download the
   update from the release page instead."
6. Always reset `updateProgress = null` at the end.

**What Android does next:** the first time, it asks the person to allow installs from
this app (Settings › Install unknown apps), then shows its own install screen. Because the
signing key and package name match and `versionCode` is higher, it installs over the old
version and keeps all data. The app process is killed and restarted by the install; that
is normal.

**Manifest:**

```xml
<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
<provider
    android:name="androidx.core.content.FileProvider"
    android:authorities="${applicationId}.files"
    android:exported="false"
    android:grantUriPermissions="true">
    <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/file_paths" />
</provider>
```

`res/xml/file_paths.xml` exposes only the update folder:

```xml
<paths><cache-path name="update" path="update/" /></paths>
```

## 8. The Settings row

One row near the top of the About (or "About & help") page:

| State | Label | Detail line | Button |
|---|---|---|---|
| Not checked yet | `<App> <current>` | "New versions are checked on GitHub each time <App> opens. Nothing about you or your phone is sent." | Check for updates |
| Checking | same | same | Checking… (disabled) |
| Up to date | same | "You have the newest version, Y." | Check for updates |
| Offline | same | "Couldn't reach GitHub. Check your connection and try again." | Check for updates |
| Update known | same, icon in the accent colour | "<App> X is available. You have Y." | Update to X |
| Downloading | same | "Downloading X… 42%" | Downloading (disabled) |

Next to it, the changelog skill's "What's new" row. A plain "Release page" link to the
public releases page is a useful fallback.

## 9. Copy

Written for the people using the app, not for developers.

- Dialog title: "<App> X is available".
- Dialog text: "You have Y. Update downloads the new version (12 MB) and Android asks you
  to install it. Your <the app's data, in its own words> are kept."
- While downloading: "Downloading… 42%. Android will then ask you to install it."
- Buttons: **Update** (confirm), **Ignore** (dismiss). Not "Later", not "Skip".
- Never say "APK" on screen; say "the new version".

## 10. Privacy and security

- No token, key or secret ships in the app. The endpoint is public.
- The request carries no identifier: no device id, no version in the query, no analytics.
- Downloads are HTTPS end to end, size-capped and stored in the cache, not in shared
  storage.
- The FileProvider exposes one folder, and only to the installer, for one grant.
- Android itself verifies that the update is signed with the same key, so a tampered
  APK cannot install over the real app. Never sign releases with a per-build debug key,
  and never rotate the key without a plan: every existing user would have to uninstall.

## 11. Acceptance checklist

- [ ] Opening the app with a newer release published shows the dialog once, after any
      onboarding or tour.
- [ ] Opening it again in the same process does not ask again; a fresh start does.
- [ ] Ignore stops the automatic prompt for that version, and the next version asks again.
- [ ] "Check for updates" asks about an ignored version, and says "up to date" otherwise.
- [ ] Airplane mode at start: no error shown, and a previously found update is still
      offered.
- [ ] Update shows a percentage, opens Android's installer, and the new version installs
      over the old one with all data kept.
- [ ] A download cut off midway leaves no partial file and shows a sentence, not a crash.
- [ ] A content-pack release published after the app release is not offered as an update.
- [ ] `isNewer("0.10.0", "0.9.9")` is true; `isNewer("1.0.0", "1.0.0")` is false.
- [ ] No token or secret in the APK (`unzip -p app.apk | strings | grep -i token` finds
      nothing of yours).
- [ ] The Settings row shows every state in §8.

## 12. File manifest

| File | Where it goes |
|---|---|
| `assets/Updates.kt` | `app/src/main/java/<package>/Updates.kt` |
| `assets/UpdateController.kt` | Merge into the app's view model. |
| `assets/Net.kt` | `app/src/main/java/<package>/Net.kt` (or reuse the app's download helper, if it follows §7). |
| `assets/UpdateUi.kt` | The dialog next to the main screen, and the row in the About page. |
| `assets/AndroidManifest.snippet.xml` | Merge into `AndroidManifest.xml`. |
| `assets/file_paths.xml` | `app/src/main/res/xml/file_paths.xml` |
| `assets/release.yml` | Merge its publishing steps into `.github/workflows/`. |
