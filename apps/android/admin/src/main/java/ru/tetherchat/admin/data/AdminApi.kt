package ru.tetherchat.admin.data

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ru.tetherchat.admin.BuildConfig
import java.util.concurrent.TimeUnit

class AdminApi(private val session: SessionStore) {
  val json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    coerceInputValues = true
    encodeDefaults = false
  }
  private val media = "application/json; charset=utf-8".toMediaType()
  private val client = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(45, TimeUnit.SECONDS)
    .build()
  private val base = BuildConfig.API_URL.trimEnd('/')

  fun login(login: String, password: String): AdminSession =
    post<LoginBody, AdminSession>("/api/admin/login", LoginBody(login.trim(), password), authed = false).also(session::save)

  fun pendingReports(): List<MessageReport> = get("/api/admin/reports?status=pending")
  fun closedReports(): List<MessageReport> = get("/api/admin/reports?status=closed")
  fun report(id: String): MessageReport = get("/api/admin/reports/$id")
  fun pardon(id: String): MessageReport = postRaw("/api/admin/reports/$id/pardon", "{}")
  fun ban(id: String, hours: Int?, message: String): MessageReport =
    post("/api/admin/reports/$id/ban", BanBody(hours, message))
  fun bans(): List<SiteBan> = get("/api/admin/bans")
  fun liftBan(id: String): SiteBan = postRaw("/api/admin/bans/$id/lift", "{}")

  fun logout() = session.clear()

  private inline fun <reified T> get(path: String): T = decode(request(path, "GET", null, true))

  private inline fun <reified B, reified T> post(path: String, body: B, authed: Boolean = true): T =
    decode(request(path, "POST", json.encodeToString(body), authed))

  private inline fun <reified T> postRaw(path: String, raw: String): T =
    decode(request(path, "POST", raw, true))

  private inline fun <reified T> decode(text: String): T {
    if (text.isBlank() || T::class == Unit::class) {
      @Suppress("UNCHECKED_CAST")
      return Unit as T
    }
    return json.decodeFromString(text)
  }

  private fun request(path: String, method: String, body: String?, authed: Boolean): String {
    val builder = Request.Builder().url(base + path).header("Accept", "application/json")
    if (method == "GET") builder.get() else builder.method(method, (body ?: "{}").toRequestBody(media))
    if (authed) {
      val token = session.accessToken
      if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer $token")
    }
    client.newCall(builder.build()).execute().use { response ->
      val text = response.body?.string().orEmpty()
      if (response.code == 401) {
        session.clear()
        throw ApiException(401, "Сессия истекла, войдите снова")
      }
      if (!response.isSuccessful) {
        val err = runCatching { json.decodeFromString<ApiErrorBody>(text) }.getOrNull()
        throw ApiException(response.code, err?.message ?: "Ошибка ${response.code}")
      }
      return text
    }
  }
}
