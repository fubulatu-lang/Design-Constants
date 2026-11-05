package com.example.app // TODO: your package

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Checking for a newer version of the app. The app asks GitHub for the newest public release
 * of [RELEASES_REPO]; nothing about the person or the phone is sent, and no token is used
 * (anything shipped in an APK can be read by anyone who has it).
 *
 * If the code repository is private, CI also publishes each APK to a small public repository
 * that holds only releases, and [RELEASES_REPO] names that one. See references/publishing.md.
 */
object Updates {
    const val APP = "MyApp"                        // TODO: the app's name, as in the APK file name
    const val RELEASES_REPO = "owner/myapp-releases" // TODO: <owner>/<repo> whose releases hold the APKs

    /** [apk]: the release's APK, downloaded and handed to Android's installer by "Update". */
    class Release(val version: String, val page: String, val apk: String, val apkBytes: Long)

    /** The URL CI publishes each APK at; used when the release lists no assets. */
    fun apkUrl(version: String) = "https://github.com/$RELEASES_REPO/releases/download/v$version/$APP-$version.apk"

    /**
     * True when [latest] (e.g. "0.18.0" or "v0.18.0") is a higher MAJOR.MINOR.PATCH than
     * [current]. Numeric, part by part: 0.10.0 is newer than 0.9.9. Anything after "-" is
     * ignored, and a missing or non-numeric part counts as 0.
     */
    fun isNewer(latest: String, current: String): Boolean {
        fun parts(v: String) = v.trim().removePrefix("v").substringBefore('-').split('.').map { it.toIntOrNull() ?: 0 } + listOf(0, 0, 0)
        val a = parts(latest)
        val b = parts(current)
        for (i in 0 until 3) if (a[i] != b[i]) return a[i] > b[i]
        return false
    }

    /**
     * The newest release marked "latest", or null if GitHub can't be reached, refuses
     * (unauthenticated requests are limited to 60 an hour per IP), or there is none.
     * Blocking: call off the main thread.
     */
    fun latest(): Release? = try {
        val c = URL("https://api.github.com/repos/$RELEASES_REPO/releases/latest").openConnection() as HttpURLConnection
        c.connectTimeout = 8000
        c.readTimeout = 8000
        c.setRequestProperty("Accept", "application/vnd.github+json")
        c.setRequestProperty("User-Agent", APP)
        try {
            if (c.responseCode != 200) null
            else {
                val o = JSONObject(c.inputStream.bufferedReader().readText())
                val tag = o.optString("tag_name")
                val v = tag.removePrefix("v")
                // The APK attached to the release (the one CI uploads), with its size for the progress bar.
                val assets = o.optJSONArray("assets")
                var apk = apkUrl(v)
                var size = 0L
                if (assets != null) for (i in 0 until assets.length()) {
                    val a = assets.getJSONObject(i)
                    if (a.optString("name").endsWith(".apk")) { apk = a.optString("browser_download_url", apk); size = a.optLong("size"); break }
                }
                if (tag.isBlank()) null else Release(v, o.optString("html_url", "https://github.com/$RELEASES_REPO/releases/latest"), apk, size)
            }
        } finally {
            c.disconnect()
        }
    } catch (e: Exception) {
        null
    }
}
