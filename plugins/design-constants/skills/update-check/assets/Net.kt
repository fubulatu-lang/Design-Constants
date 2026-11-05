package com.example.app // TODO: your package

import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Downloads over HTTPS only. Used for app updates (and any other file the app fetches). */
object Net {
    /**
     * Saves [url] to [dest], following at most 5 redirects, each HTTPS (GitHub sends downloads
     * to its file server). Stops past [maxBytes]. [progress] gets 0..1. Blocking. Throws
     * IllegalStateException with a message for the person using the app; [dest] is deleted on failure.
     */
    fun download(url: String, dest: File, maxBytes: Long, expectBytes: Long, what: String, progress: (Float) -> Unit) {
        try {
            var u = URL(url)
            if (u.protocol != "https") throw IllegalStateException("The $what download didn't start.")
            var c: HttpURLConnection
            var hops = 0
            while (true) {
                c = u.openConnection() as HttpURLConnection
                c.instanceFollowRedirects = false
                c.connectTimeout = 15000
                c.readTimeout = 30000
                c.setRequestProperty("User-Agent", Updates.APP)
                val code = c.responseCode
                if (code in 300..399 && hops++ < 5) {
                    val next = URL(u, c.getHeaderField("Location") ?: throw IllegalStateException("The $what download didn't start. Try again later."))
                    c.disconnect()
                    if (next.protocol != "https") throw IllegalStateException("The $what download didn't start. Try again later.")
                    u = next
                    continue
                }
                if (code != 200) throw IllegalStateException("The $what isn't available right now (error $code). Try again later.")
                break
            }
            val total = c.contentLengthLong.takeIf { it > 0 } ?: expectBytes
            dest.parentFile?.mkdirs()
            c.inputStream.use { input ->
                dest.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    var got = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        got += n
                        if (got > maxBytes) throw IllegalStateException("The $what download was larger than expected, so it was stopped.")
                        out.write(buf, 0, n)
                        progress((got.toFloat() / total).coerceIn(0f, 1f))
                    }
                }
            }
            c.disconnect()
        } catch (e: IllegalStateException) {
            dest.delete()
            throw e
        } catch (e: Exception) {
            dest.delete()
            throw IllegalStateException("Couldn't download the $what. Check your connection and try again.")
        }
    }
}
