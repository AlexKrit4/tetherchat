package ru.tetherchat.app

import android.webkit.CookieManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

object SessionRefresh {
  fun accessToken(siteUrl: String, timeoutMs: Int = 8_000): String? {
    val cookieManager = CookieManager.getInstance()
    cookieManager.flush()
    val refresh = readRefreshCookie(cookieManager, siteUrl) ?: return null

    val endpoint = "${siteUrl.trimEnd('/')}/api/auth/refresh"
    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      doOutput = true
      connectTimeout = timeoutMs
      readTimeout = timeoutMs
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("Cookie", "tc_refresh=$refresh")
    }
    return try {
      connection.outputStream.use { it.write("{}".toByteArray()) }
      persistSetCookie(cookieManager, endpoint, connection)
      if (connection.responseCode !in 200..299) return null
      val body = connection.inputStream.bufferedReader().readText()
      JSONObject(body).optString("accessToken").ifBlank { null }
    } catch (_: Exception) {
      null
    } finally {
      connection.disconnect()
      cookieManager.flush()
    }
  }

  fun hasRefreshCookie(siteUrl: String): Boolean {
    CookieManager.getInstance().flush()
    return readRefreshCookie(CookieManager.getInstance(), siteUrl) != null
  }

  private fun readRefreshCookie(cookieManager: CookieManager, siteUrl: String): String? {
    val urls = listOf(
      "${siteUrl.trimEnd('/')}/api/auth/refresh",
      "${siteUrl.trimEnd('/')}/api/auth",
      siteUrl.trimEnd('/'),
    )
    for (url in urls) {
      val cookies = cookieManager.getCookie(url) ?: continue
      val value = cookies
        .split(";")
        .map { it.trim() }
        .firstOrNull { it.startsWith("tc_refresh=") }
        ?.substringAfter("=")
      if (!value.isNullOrBlank()) return value
    }
    return null
  }

  private fun persistSetCookie(
    cookieManager: CookieManager,
    url: String,
    connection: HttpURLConnection,
  ) {
    val fields = connection.headerFields ?: return
    val setCookies = fields.filterKeys { it.equals("Set-Cookie", ignoreCase = true) }.values.flatten()
    for (header in setCookies) {
      if (!header.isNullOrBlank()) cookieManager.setCookie(url, header)
    }
  }
}
