package ru.tetherchat.app.data

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import ru.tetherchat.app.BuildConfig
import java.io.File
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
    .readTimeout(45, TimeUnit.SECONDS)
    .writeTimeout(45, TimeUnit.SECONDS)
    .build()

  private val downloadClient by lazy {
    OkHttpClient.Builder()
      .connectTimeout(20, TimeUnit.SECONDS)
      .readTimeout(10, TimeUnit.MINUTES)
      .writeTimeout(2, TimeUnit.MINUTES)
      .followRedirects(true)
      .followSslRedirects(true)
      .build()
  }

  private val base = BuildConfig.API_URL.trimEnd('/')

  fun login(login: String, password: String): AuthResponse {
    val response = post<LoginBody, AuthResponse>("/api/auth/login", LoginBody(login, password), authed = false)
    if (!response.requires2fa) session.save(response)
    return response
  }

  fun loginTotp(ticket: String, code: String): AuthResponse =
    post<TotpLoginBody, AuthResponse>("/api/auth/login/totp", TotpLoginBody(ticket, code), authed = false).also(session::save)

  fun totpSetup(): TotpSetup = postRaw("/api/auth/2fa/setup", "{}")
  fun totpEnable(code: String): SelfUser = post("/api/auth/2fa/enable", TotpCodeBody(code))
  fun totpDisable(code: String, password: String): SelfUser =
    post("/api/auth/2fa/disable", TotpDisableBody(code, password))
  fun adminCredentials(code: String): AdminCredentials =
    post("/api/auth/admin-credentials", TotpCodeBody(code))

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
      session.clearActiveKeepOther()
    }
  }

  fun transcribe(attachmentId: String): TranscriptResponse =
    postRaw("/api/attachments/$attachmentId/transcribe", "{}")

  fun setPlus(userId: String, enabled: Boolean): PublicUser =
    patch("/api/admin/users/$userId/plus", PatchPlusBody(enabled))

  fun uploadDmWallpaper(id: String, bytes: ByteArray, filename: String, mime: String): DirectConversation =
    upload("/api/dms/$id/wallpaper", bytes, filename, mime)

  fun deleteDmWallpaper(id: String): DirectConversation = deleteJson("/api/dms/$id/wallpaper")

  fun uploadChannelWallpaper(id: String, bytes: ByteArray, filename: String, mime: String): ChannelNotifications =
    upload("/api/channels/$id/wallpaper", bytes, filename, mime)

  fun deleteChannelWallpaper(id: String) {
    delete("/api/channels/$id/wallpaper")
  }

  fun me(): SelfUser = get("/api/users/@me")
  fun user(id: String): PublicUser = get("/api/users/$id")
  fun patchMe(body: PatchProfileBody): SelfUser = patch("/api/users/@me", body)
  fun patchUsername(username: String): SelfUser = patch("/api/users/@me", PatchUsernameBody(username))
  fun patchEnterToSend(value: Boolean): SelfUser = patch("/api/users/@me", PatchEnterToSendBody(value))
  fun patchStatus(status: String): SelfUser = patch("/api/users/@me", PatchStatusBody(status))
  fun uploadAvatar(bytes: ByteArray, filename: String, mime: String): SelfUser =
    upload("/api/users/@me/avatar", bytes, filename, mime)
  fun deleteAvatar() = delete("/api/users/@me/avatar")
  fun readStates(): List<ReadState> = get("/api/users/@me/read-states")

  fun forgotPassword(email: String) {
    post<EmailBody, Unit>("/api/auth/forgot-password", EmailBody(email), authed = false)
  }

  fun resetPassword(token: String, password: String) {
    post<ResetPasswordBody, Unit>("/api/auth/reset-password", ResetPasswordBody(token, password), authed = false)
  }

  fun verifyEmail(token: String) {
    post<VerifyEmailBody, Unit>("/api/auth/verify-email", VerifyEmailBody(token), authed = false)
  }

  fun servers(): List<ServerSummary> = get("/api/servers")
  fun server(id: String): ServerDetail = get("/api/servers/$id")
  fun members(serverId: String): List<ServerMember> = get("/api/servers/$serverId/members")
  fun createServer(name: String): ServerDetail = post("/api/servers", CreateServerBody(name))
  fun patchServer(id: String, name: String?, description: String?): ServerSummary =
    patch("/api/servers/$id", PatchServerBody(name, description))
  fun uploadServerIcon(id: String, bytes: ByteArray, filename: String, mime: String): ServerSummary =
    upload("/api/servers/$id/icon", bytes, filename, mime)
  fun deleteServer(id: String) = delete("/api/servers/$id")
  fun leaveServer(id: String) = postRaw<Unit>("/api/servers/$id/leave", "{}")
  fun createChannel(serverId: String, name: String, topic: String?, categoryId: String?): Channel =
    post("/api/servers/$serverId/channels", CreateChannelBody(name, topic, categoryId))
  fun createCategory(serverId: String, name: String): Category =
    post("/api/servers/$serverId/categories", CreateCategoryBody(name))
  fun patchChannel(id: String, name: String?, topic: String?): Channel =
    patch("/api/channels/$id", PatchChannelBody(name, topic))
  fun deleteChannel(id: String) = delete("/api/channels/$id")

  fun roles(serverId: String): List<Role> = get("/api/servers/$serverId/roles")
  fun createRole(serverId: String, name: String): Role =
    post("/api/servers/$serverId/roles", CreateRoleBody(name))
  fun patchRole(serverId: String, roleId: String, body: PatchRoleBody): Role =
    patch("/api/servers/$serverId/roles/$roleId", body)
  fun deleteRole(serverId: String, roleId: String) = delete("/api/servers/$serverId/roles/$roleId")

  fun patchMember(serverId: String, userId: String, body: PatchMemberBody): ServerMember =
    patch("/api/servers/$serverId/members/$userId", body)
  fun kickMember(serverId: String, userId: String) = delete("/api/servers/$serverId/members/$userId")
  fun bans(serverId: String): List<Ban> = get("/api/servers/$serverId/bans")
  fun banMember(serverId: String, userId: String, reason: String?): Ban =
    put("/api/servers/$serverId/bans/$userId", BanBody(reason))
  fun unbanMember(serverId: String, userId: String) = delete("/api/servers/$serverId/bans/$userId")

  fun invites(serverId: String): List<Invite> = get("/api/servers/$serverId/invites")
  fun createInvite(serverId: String): Invite = post("/api/servers/$serverId/invite", CreateInviteBody())
  fun invitePreview(code: String): InvitePreview = get("/api/invite/$code", authed = false)
  fun joinInvite(code: String): String {
    val result: JoinResult = postRaw("/api/invite/$code/join", "{}")
    return result.serverId
  }

  fun dms(deviceId: String? = null): List<DirectConversation> =
    get(if (deviceId.isNullOrBlank()) "/api/dms" else "/api/dms?deviceId=${URLEncoder.encode(deviceId, "UTF-8")}")
  fun conversation(id: String): DirectConversation = get("/api/dms/$id")
  fun savedMessages(): DirectConversation = get("/api/dms/saved")
  fun openDm(userId: String): DirectConversation = post("/api/dms", CreateDmBody(listOf(userId)))
  fun openGroup(userIds: List<String>, name: String?): DirectConversation =
    post("/api/dms", CreateGroupDmBody(userIds, name))
  fun createSecretConversation(userId: String, keys: List<WrappedSecretKey>): DirectConversation =
    post("/api/dms/secret", SecretConversationBody(userId, keys))
  fun leaveGroup(id: String) = postRaw<Unit>("/api/dms/$id/leave", "{}")
  fun deleteConversation(id: String, scope: String) = delete("/api/dms/$id?scope=$scope")
  fun pinConversation(id: String): DirectConversation = postRaw("/api/dms/$id/pin", "{}")
  fun unpinConversation(id: String): DirectConversation = deleteJson("/api/dms/$id/pin")
  fun chatMedia(channelId: String, dm: Boolean): List<ChatMediaItem> =
    get<MediaPage>(if (dm) "/api/dms/$channelId/media" else "/api/channels/$channelId/media").items

  fun friends(): List<PublicUser> = get("/api/friends")
  fun registerCryptoDevice(body: CryptoDeviceBody): CryptoDevice = post("/api/e2ee/devices", body)
  fun revokeCryptoDevice(deviceId: String) = delete("/api/e2ee/devices/$deviceId")
  fun cryptoDevices(userId: String): List<CryptoDevice> = get("/api/e2ee/users/$userId/devices")
  fun secretConversationKey(conversationId: String, deviceId: String): SecretKeyResponse =
    get("/api/e2ee/conversations/$conversationId/key/$deviceId")
  fun claimSecretConversation(conversationId: String, deviceId: String): SecretClaimStatus =
    post("/api/e2ee/conversations/$conversationId/claim", SecretClaimBody(deviceId))
  fun deliverSecretKey(conversationId: String, body: SecretDeliverBody) =
    post<SecretDeliverBody, Unit>("/api/e2ee/conversations/$conversationId/deliver-key", body)
  fun pendingSecretClaims(): List<SecretClaimPending> =
    get("/api/e2ee/conversations/pending-claims")
  fun incomingFriends(): List<FriendRequest> = get("/api/friends/incoming")
  fun incomingFriendCount(): Int = get<CountBody>("/api/friends/incoming/count").count
  fun sendFriendRequest(userId: String): FriendRequestResult =
    post("/api/friends/requests", FriendRequestBody(userId = userId))
  fun acceptFriend(id: String) = postRaw<Unit>("/api/friends/requests/$id/accept", "{}")
  fun declineFriend(id: String) = postRaw<Unit>("/api/friends/requests/$id/decline", "{}")

  fun reportMessage(messageId: String, comment: String) {
    post<ReportBody, Unit>("/api/reports", ReportBody(messageId, comment))
  }
  fun searchUsers(q: String): List<PublicUser> =
    get("/api/users?q=${URLEncoder.encode(q, "UTF-8")}")

  fun blocks(): List<PublicUser> = get("/api/users/@me/blocks")
  fun blockUser(userId: String): PublicUser = put("/api/users/@me/blocks/$userId", EmptyBody)
  fun unblockUser(userId: String) = delete("/api/users/@me/blocks/$userId")

  fun fcmConfig(): FcmClientConfig = get("/api/push/android-config", authed = false)

  fun subscribeFcm(token: String) {
    post<FcmSubscribeBody, Unit>("/api/push/subscribe", FcmSubscribeBody(platform = "fcm", token = token))
  }

  fun unsubscribeFcm(token: String) {
    post<FcmUnsubscribeBody, Unit>("/api/push/unsubscribe", FcmUnsubscribeBody(token))
  }

  fun androidRelease(): AndroidRelease {
    val bust = System.currentTimeMillis()
    return runCatching { get<AndroidRelease>("/app/version.json?t=$bust", authed = false) }
      .getOrElse { get("/api/app/android", authed = false) }
  }

  fun downloadTo(url: String, dest: File, onProgress: (read: Long, total: Long) -> Unit) {
    dest.parentFile?.mkdirs()
    val tmp = File(dest.parentFile, "${dest.name}.part")
    tmp.delete()
    val request = Request.Builder().url(url).header("Accept", "*/*").get().build()
    downloadClient.newCall(request).execute().use { response ->
      if (!response.isSuccessful) {
        throw ApiException(response.code, "http", "Не удалось скачать обновление (${response.code})")
      }
      val body = response.body ?: throw ApiException(0, "http", "Пустой ответ сервера")
      val total = body.contentLength()
      tmp.outputStream().use { out ->
        body.byteStream().use { input ->
          val buf = ByteArray(32 * 1024)
          var read = 0L
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            out.write(buf, 0, n)
            read += n
            onProgress(read, total)
          }
        }
      }
    }
    dest.delete()
    if (!tmp.renameTo(dest)) {
      tmp.copyTo(dest, overwrite = true)
      tmp.delete()
    }
  }

  fun messages(channelId: String, before: String? = null, dm: Boolean): MessagePage {
    val path = if (dm) "/api/dms/$channelId/messages" else "/api/channels/$channelId/messages"
    val query = if (before.isNullOrBlank()) "" else "?before=$before"
    return get("$path$query")
  }

  fun searchMessages(channelId: String, q: String, dm: Boolean): List<Message> {
    val path = if (dm) "/api/dms/$channelId/messages/search" else "/api/channels/$channelId/messages/search"
    return get("$path?q=${URLEncoder.encode(q, "UTF-8")}")
  }

  fun pins(channelId: String): List<Message> = get("/api/channels/$channelId/pins")

  fun send(
    channelId: String,
    content: String,
    dm: Boolean,
    nonce: String,
    replyToId: String? = null,
    attachmentIds: List<String>? = null,
    attachmentDurations: Map<String, Int>? = null,
    attachmentSpoilers: Map<String, Boolean>? = null,
    forwardMessageId: String? = null,
  ): Message {
    val path = if (dm) "/api/dms/$channelId/messages" else "/api/channels/$channelId/messages"
    return post(
      path,
      SendMessageBody(content, nonce, replyToId, attachmentIds, attachmentDurations, attachmentSpoilers, forwardMessageId),
    )
  }

  fun sendEncrypted(channelId: String, envelope: EncryptedEnvelope, nonce: String): Message =
    post("/api/dms/$channelId/messages", EncryptedMessageBody(envelope, nonce))

  fun editMessage(messageId: String, content: String): Message =
    patch("/api/messages/$messageId", EditMessageBody(content))

  fun deleteMessage(messageId: String) = delete("/api/messages/$messageId")

  fun react(messageId: String, emoji: String): ReactionUpdatedEvent =
    put("/api/messages/$messageId/reactions", ReactBody(emoji))

  fun pin(channelId: String, messageId: String) {
    put<EmptyBody, Unit>("/api/channels/$channelId/pins/$messageId", EmptyBody)
  }
  fun unpin(channelId: String, messageId: String) = delete("/api/channels/$channelId/pins/$messageId")

  fun ack(channelId: String, messageId: String, dm: Boolean) {
    val path = if (dm) "/api/dms/$channelId/ack" else "/api/channels/$channelId/ack"
    post<AckBody, Unit>(path, AckBody(messageId))
  }

  fun notifications(channelId: String): ChannelNotifications = get("/api/channels/$channelId/notifications")
  fun muteChannel(channelId: String, muted: Boolean): ChannelNotifications =
    put("/api/channels/$channelId/notifications", NotificationLevelBody(muted = muted))
  fun setNotificationLevel(channelId: String, level: String): ChannelNotifications =
    put("/api/channels/$channelId/notifications", NotificationLevelBody(level = level))

  fun uploadFile(bytes: ByteArray, filename: String, mime: String, durationMs: Int? = null): Attachment {
    val query = if (durationMs != null) "?durationMs=$durationMs" else ""
    return upload("/api/upload$query", bytes, filename, mime)
  }

  fun sessions(): List<DeviceSession> = get("/api/auth/sessions")
  fun revokeSession(id: String) = delete("/api/auth/sessions/$id")
  fun revokeOtherSessions() = postRaw<Unit>("/api/auth/sessions/revoke-others", "{}")

  fun approveQrLogin(ticket: String) =
    post<QrApproveBody, QrApproveResponse>("/api/auth/qr/approve", QrApproveBody(ticket))

  fun startCall(conversationId: String): CallStartResponse =
    post("/api/calls/start", CallStartBody(conversationId))

  fun acceptCall(callId: String): CallSignalPayload =
    postRaw("/api/calls/$callId/accept", "{}")

  fun declineCall(callId: String) {
    postRaw<Unit>("/api/calls/$callId/decline", "{}")
  }

  fun endCall(callId: String) {
    postRaw<Unit>("/api/calls/$callId/end", "{}")
  }

  fun callToken(callId: String): CallTokenResponse = get("/api/calls/$callId/token")

  fun abandonCall() {
    postRaw<Unit>("/api/calls/abandon", "{}")
  }

  fun ensureAccessToken(): String = session.accessToken ?: refresh().accessToken
    ?: throw ApiException(401, "unauthorized", "Нет сессии")

  private inline fun <reified T> get(path: String, authed: Boolean = true): T =
    decode(request(path, "GET", null, authed))

  private inline fun <reified B, reified T> post(path: String, body: B, authed: Boolean = true): T =
    decode(request(path, "POST", json.encodeToString(body), authed))

  private inline fun <reified B, reified T> put(path: String, body: B): T =
    decode(request(path, "PUT", json.encodeToString(body), authed = true))

  private inline fun <reified B, reified T> patch(path: String, body: B): T =
    decode(request(path, "PATCH", json.encodeToString(body), authed = true))

  private inline fun <reified T> postRaw(path: String, raw: String): T =
    decode(request(path, "POST", raw, authed = true))

  private fun delete(path: String) {
    request(path, "DELETE", null, authed = true)
  }

  private inline fun <reified T> deleteJson(path: String): T =
    decode(request(path, "DELETE", null, authed = true))

  private inline fun <reified T> upload(
    path: String,
    bytes: ByteArray,
    filename: String,
    mime: String,
  ): T = decode(uploadRaw(path, bytes, filename, mime))

  private fun uploadRaw(
    path: String,
    bytes: ByteArray,
    filename: String,
    mime: String,
    retried: Boolean = false,
  ): String {
    val token = runCatching { ensureAccessToken() }.getOrNull()
    val body = MultipartBody.Builder()
      .setType(MultipartBody.FORM)
      .addFormDataPart("file", filename, bytes.toRequestBody(mime.toMediaType()))
      .build()
    val req = Request.Builder()
      .url(base + path)
      .header("Accept", "application/json")
      .post(body)
    if (!token.isNullOrBlank()) req.header("Authorization", "Bearer $token")
    client.newCall(req.build()).execute().use { response ->
      val text = response.body?.string().orEmpty()
      if (response.code == 401 && !retried) {
        refresh()
        return uploadRaw(path, bytes, filename, mime, retried = true)
      }
      if (!response.isSuccessful) {
        val err = runCatching { json.decodeFromString<ApiErrorBody>(text) }.getOrNull()
        throw ApiException(response.code, err?.code ?: "http", err?.message ?: "Ошибка ${response.code}")
      }
      return text
    }
  }

  private inline fun <reified T> decode(text: String): T {
    if (text.isBlank() || T::class == Unit::class) {
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
    when (method) {
      "GET" -> builder.get()
      "DELETE" -> if (body == null) builder.delete() else builder.delete(body.toRequestBody(media))
      else -> builder.method(method, (body ?: "{}").toRequestBody(media))
    }
    if (authed) {
      val token = session.accessToken ?: runCatching { refresh().accessToken }.getOrNull()
      if (!token.isNullOrBlank()) builder.header("Authorization", "Bearer $token")
      val refresh = session.refreshToken
      if (!refresh.isNullOrBlank()) builder.header("X-Refresh-Token", refresh)
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

@kotlinx.serialization.Serializable
private object EmptyBody
