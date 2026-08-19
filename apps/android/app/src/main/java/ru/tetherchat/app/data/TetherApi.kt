package ru.tetherchat.app.data

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ru.tetherchat.app.BuildConfig
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class TetherApi(private val session: SessionStore) {
  val json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    coerceInputValues = true
    encodeDefaults = false
  }

  private val media = "application/json; charset=utf-8".toMediaType()
  private val client = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .readTimeout(20, TimeUnit.SECONDS)
    .writeTimeout(20, TimeUnit.SECONDS)
    .build()

  private val base = BuildConfig.API_URL.trimEnd('/')

  fun login(login: String, password: String): AuthResponse =
    post<LoginBody, AuthResponse>("/api/auth/login", LoginBody(login, password), authed = false).also(session::save)

  fun register(email: String, username: String, password: String): AuthResponse =
    post<RegisterBody, AuthResponse>(
      "/api/auth/register",
      RegisterBody(email, username, password),
      authed = false,
    ).also(session::save)

  fun refresh(): AuthResponse {
    val token = session.refreshToken ?: throw ApiException(401, "unauthorized", "Нет сессии")
    return post<RefreshBody, AuthResponse>("/api/auth/refresh", RefreshBody(token), authed = false).also(session::save)
  }

  fun logout() {
    val token = session.refreshToken
    try {
      if (!token.isNullOrBlank()) {
        request("/api/auth/logout", "POST", json.encodeToString(LogoutBody(token)), authed = false)
      }
    } catch (_: Exception) {
    } finally {
      session.clear()
    }
  }

  fun me(): SelfUser = get("/api/users/@me")
  fun servers(): List<ServerSummary> = get("/api/servers")
  fun server(id: String): ServerDetail = get("/api/servers/$id")
  fun members(serverId: String): List<ServerMember> = get("/api/servers/$serverId/members")
  fun createServer(name: String): ServerDetail = post("/api/servers", CreateServerBody(name))
  fun joinInvite(code: String): String {
    val result: JoinResult = postRaw("/api/invite/$code/join", "{}")
    return result.serverId
  }
  fun dms(): List<DirectConversation> = get("/api/dms")
  fun openDm(userId: String): DirectConversation = post("/api/dms", CreateDmBody(listOf(userId)))
  fun searchUsers(q: String): List<PublicUser> =
    get("/api/users?q=${URLEncoder.encode(q, "UTF-8")}")

  fun messages(channelId: String, before: String? = null, dm: Boolean): MessagePage {
    val path = if (dm) "/api/dms/$channelId/messages" else "/api/channels/$channelId/messages"
    val query = if (before.isNullOrBlank()) "" else "?before=$before"
    return get("$path$query")
  }

  fun send(channelId: String, content: String, dm: Boolean, nonce: String): Message {
    val path = if (dm) "/api/dms/$channelId/messages" else "/api/channels/$channelId/messages"
    return post(path, SendMessageBody(content, nonce))
  }

  fun ensureAccessToken(): String = session.accessToken ?: refresh().accessToken

  private inline fun <reified T> get(path: String): T = decode(request(path, "GET", null, authed = true))

  private inline fun <reified B, reified T> post(path: String, body: B, authed: Boolean = true): T =
    decode(request(path, "POST", json.encodeToString(body), authed))

  private inline fun <reified T> postRaw(path: String, raw: String): T =
    decode(request(path, "POST", raw, authed = true))

  private inline fun <reified T> decode(text: String): T {
    if (text.isBlank()) {
      @Suppress("UNCHECKED_CAST")
      return Unit as T
    }
    return json.decodeFromString(text)
  }

  private fun request(
    path: String,
    method: String,
    body: String?,
    authed: Boolean,
    retried: Boolean = false,
  ): String {
    val builder = Request.Builder()
      .url(base + path)
      .header("Accept", "application/json")
    if (method == "GET") {
      builder.get()
    } else {
      builder.method(method, (body ?: "{}").toRequestBody(media))
    }
    if (authed) {
      val token = session.accessToken ?: runCatching { refresh().accessToken }.getOrNull()
      if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer $token")
    }
    client.newCall(builder.build()).execute().use { response ->
      val text = response.body?.string().orEmpty()
      if (response.code == 401 && authed && !retried) {
        refresh()
        return request(path, method, body, authed = true, retried = true)
      }
      if (response.code == 204) return ""
      if (!response.isSuccessful) {
        val err = runCatching { json.decodeFromString<ApiErrorBody>(text) }.getOrNull()
        throw ApiException(response.code, err?.code ?: "http", err?.message ?: "Ошибка ${response.code}")
      }
      return text
    }
  }
}
