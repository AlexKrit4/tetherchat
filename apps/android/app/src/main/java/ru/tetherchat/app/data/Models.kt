package ru.tetherchat.app.data

import kotlinx.serialization.Serializable

@Serializable
data class ApiErrorBody(
  val code: String = "error",
  val message: String = "Что-то пошло не так",
)

class ApiException(val status: Int, val code: String, override val message: String) : RuntimeException(message)

@Serializable
data class PublicUser(
  val id: String,
  val username: String,
  val displayName: String? = null,
  val avatarUrl: String? = null,
  val bannerColor: String? = null,
  val bio: String? = null,
  val customStatus: String? = null,
  val status: String = "offline",
  val createdAt: String = "",
) {
  val label: String get() = displayName?.takeIf { it.isNotBlank() } ?: username
}

@Serializable
data class SelfUser(
  val id: String,
  val username: String,
  val displayName: String? = null,
  val avatarUrl: String? = null,
  val bannerColor: String? = null,
  val bio: String? = null,
  val customStatus: String? = null,
  val status: String = "online",
  val createdAt: String = "",
  val email: String = "",
  val emailVerified: Boolean = false,
  val enterToSend: Boolean = true,
  val totpEnabled: Boolean = false,
  val isPlatformAdmin: Boolean = false,
) {
  val label: String get() = displayName?.takeIf { it.isNotBlank() } ?: username

  fun asPublic(): PublicUser = PublicUser(
    id = id,
    username = username,
    displayName = displayName,
    avatarUrl = avatarUrl,
    bannerColor = bannerColor,
    bio = bio,
    customStatus = customStatus,
    status = status,
    createdAt = createdAt,
  )
}

@Serializable
data class AuthResponse(
  val accessToken: String? = null,
  val expiresIn: Int = 900,
  val refreshToken: String? = null,
  val user: SelfUser? = null,
  val requires2fa: Boolean = false,
  val ticket: String? = null,
)

@Serializable
data class ServerSummary(
  val id: String,
  val name: String,
  val iconUrl: String? = null,
  val description: String? = null,
  val ownerId: String = "",
  val memberCount: Int = 0,
)

@Serializable
data class Category(
  val id: String,
  val serverId: String = "",
  val name: String,
  val position: Int = 0,
)

@Serializable
data class Channel(
  val id: String,
  val serverId: String,
  val categoryId: String? = null,
  val name: String,
  val topic: String? = null,
  val position: Int = 0,
  val createdAt: String = "",
)

@Serializable
data class ServerDetail(
  val id: String,
  val name: String,
  val iconUrl: String? = null,
  val description: String? = null,
  val ownerId: String = "",
  val memberCount: Int = 0,
  val categories: List<Category> = emptyList(),
  val channels: List<Channel> = emptyList(),
  val roles: List<Role> = emptyList(),
  val permissions: Int = 0,
)

@Serializable
data class Role(
  val id: String,
  val serverId: String = "",
  val name: String,
  val color: String? = null,
  val permissions: Int = 0,
  val position: Int = 0,
  val isDefault: Boolean = false,
  val hoist: Boolean = false,
)

@Serializable
data class ServerMember(
  val userId: String,
  val serverId: String = "",
  val nickname: String? = null,
  val joinedAt: String = "",
  val roleIds: List<String> = emptyList(),
  val user: PublicUser,
) {
  val label: String get() = nickname?.takeIf { it.isNotBlank() } ?: user.label
}

@Serializable
data class Attachment(
  val id: String,
  val url: String = "",
  val filename: String = "",
  val contentType: String = "",
  val size: Int = 0,
  val width: Int? = null,
  val height: Int? = null,
  val durationMs: Int? = null,
  val spoiler: Boolean = false,
) {
  val isImage: Boolean get() = contentType.startsWith("image/")
  val isVideo: Boolean get() = contentType.startsWith("video/")
  val isAudio: Boolean get() = contentType.startsWith("audio/")
}

@Serializable
data class MessageReference(
  val id: String,
  val authorId: String = "",
  val author: PublicUser? = null,
  val content: String = "",
  val deleted: Boolean = false,
)

@Serializable
data class Reaction(
  val emoji: String,
  val count: Int = 0,
  val userIds: List<String> = emptyList(),
  val me: Boolean = false,
)

@Serializable
data class LinkPreview(
  val url: String = "",
  val title: String? = null,
  val description: String? = null,
  val imageUrl: String? = null,
  val siteName: String? = null,
)

@Serializable
data class Message(
  val id: String,
  val channelId: String,
  val serverId: String? = null,
  val authorId: String,
  val author: PublicUser,
  val content: String = "",
  val encrypted: EncryptedEnvelope? = null,
  val createdAt: String = "",
  val editedAt: String? = null,
  val pinned: Boolean = false,
  val system: Boolean = false,
  val replyTo: MessageReference? = null,
  val forwardedFrom: MessageReference? = null,
  val attachments: List<Attachment> = emptyList(),
  val reactions: List<Reaction> = emptyList(),
  val previews: List<LinkPreview> = emptyList(),
  val nonce: String? = null,
)

@Serializable
data class MessagePage(
  val items: List<Message> = emptyList(),
  val hasMore: Boolean = false,
)

@Serializable
data class DirectConversation(
  val id: String,
  val isGroup: Boolean = false,
  val isSaved: Boolean = false,
  val isAi: Boolean = false,
  val isSecret: Boolean = false,
  val name: String? = null,
  val iconUrl: String? = null,
  val ownerId: String? = null,
  val members: List<PublicUser> = emptyList(),
  val lastMessageAt: String? = null,
  val peerLastReadMessageId: String? = null,
  val peerLastReadAt: String? = null,
  val pinned: Boolean = false,
) {
  fun title(meId: String): String {
    if (isSaved) return "Избранное"
    if (isAi) return "Нейросеть"
    if (isGroup) return name?.takeIf { it.isNotBlank() } ?: members.joinToString { it.label }
    return members.firstOrNull { it.id != meId }?.label ?: "Личные сообщения"
  }

  fun peer(meId: String): PublicUser? = members.firstOrNull { it.id != meId }

  val showsReceipts: Boolean get() = !isGroup && !isSaved && !isAi
  val lockedInList: Boolean get() = isSaved || isAi
}

@Serializable
data class LoginBody(val login: String, val password: String)

@Serializable
data class RegisterBody(
  val email: String,
  val username: String,
  val password: String,
  val displayName: String? = null,
)

@Serializable
data class RefreshBody(val refreshToken: String)

@Serializable
data class LogoutBody(val refreshToken: String)

@Serializable
data class SendMessageBody(
  val content: String,
  val nonce: String? = null,
  val replyToId: String? = null,
  val attachmentIds: List<String>? = null,
  val attachmentDurations: Map<String, Int>? = null,
  val attachmentSpoilers: Map<String, Boolean>? = null,
  val forwardMessageId: String? = null,
)

@Serializable
data class EncryptedEnvelope(
  val version: Int = 1,
  val iv: String,
  val ciphertext: String,
)

@Serializable
data class EncryptedMessageBody(
  val encrypted: EncryptedEnvelope,
  val nonce: String? = null,
)

@Serializable
data class CryptoDeviceBody(
  val deviceId: String,
  val name: String? = null,
  val publicKey: String,
)

@Serializable
data class CryptoDevice(
  val id: String,
  val userId: String,
  val name: String? = null,
  val publicKey: String,
  val createdAt: String = "",
)

@Serializable
data class WrappedSecretKey(
  val deviceId: String,
  val wrappedKey: String,
)

@Serializable
data class SecretConversationBody(
  val userId: String,
  val keys: List<WrappedSecretKey>,
)

@Serializable
data class SecretKeyResponse(
  val deviceId: String,
  val wrappedKey: String,
)

@Serializable
data class CreateDmBody(val userIds: List<String>)

@Serializable
data class CreateServerBody(val name: String)

@Serializable
data class JoinResult(val serverId: String)

@Serializable
data class PresenceEvent(val userId: String, val status: String)

@Serializable
data class PatchProfileBody(
  val displayName: String?,
  val customStatus: String?,
  val bio: String?,
)

@Serializable
data class PatchStatusBody(val status: String)

@Serializable
data class EditMessageBody(val content: String)

@Serializable
data class ReactBody(val emoji: String)

@Serializable
data class AckBody(val messageId: String)

@Serializable
data class MuteBody(val muted: Boolean)

@Serializable
data class ChannelNotifications(
  val channelId: String = "",
  val level: String = "all",
  val muted: Boolean = false,
)

@Serializable
data class MessageDeletedEvent(
  val messageId: String,
  val channelId: String,
)

@Serializable
data class ReactionUpdatedEvent(
  val messageId: String,
  val channelId: String,
  val reactions: List<Reaction> = emptyList(),
)

data class PendingUpload(
  val localId: String,
  val filename: String,
  val mime: String,
  val attachment: Attachment? = null,
  val error: String? = null,
  val spoiler: Boolean = false,
)

@Serializable
data class TypingEvent(
  val channelId: String = "",
  val users: List<TypingUser> = emptyList(),
)

@Serializable
data class TypingUser(
  val id: String = "",
  val username: String = "",
)

@Serializable
data class ReadState(
  val channelId: String,
  val lastReadMessageId: String? = null,
  val lastReadAt: String? = null,
  val mentionCount: Int = 0,
  val unread: Boolean = false,
)

@Serializable
data class Invite(
  val code: String,
  val serverId: String = "",
  val uses: Int = 0,
  val maxUses: Int? = null,
  val expiresAt: String? = null,
)

@Serializable
data class InvitePreview(
  val code: String,
  val server: ServerSummary,
  val inviter: PublicUser,
  val alreadyMember: Boolean = false,
)

@Serializable
data class Ban(
  val userId: String,
  val serverId: String = "",
  val reason: String? = null,
  val createdAt: String = "",
  val user: PublicUser,
)

@Serializable
data class EmailBody(val email: String)

@Serializable
data class ResetPasswordBody(val token: String, val password: String)

@Serializable
data class VerifyEmailBody(val token: String)

@Serializable
data class PatchUsernameBody(val username: String)

@Serializable
data class PatchEnterToSendBody(val enterToSend: Boolean)

@Serializable
data class PatchServerBody(val name: String? = null, val description: String? = null)

@Serializable
data class CreateChannelBody(
  val name: String,
  val topic: String? = null,
  val categoryId: String? = null,
)

@Serializable
data class CreateCategoryBody(val name: String)

@Serializable
data class PatchChannelBody(val name: String? = null, val topic: String? = null)

@Serializable
data class CreateInviteBody(val maxUses: Int? = null, val expiresInHours: Int? = null)

@Serializable
data class CreateRoleBody(val name: String)

@Serializable
data class PatchRoleBody(
  val name: String? = null,
  val permissions: Int? = null,
  val hoist: Boolean? = null,
  val color: String? = null,
)

@Serializable
data class PatchMemberBody(
  val nickname: String? = null,
  val roleIds: List<String>? = null,
)

@Serializable
data class BanBody(val reason: String? = null)

@Serializable
data class CreateGroupDmBody(val userIds: List<String>, val name: String? = null)

@Serializable
data class NotificationLevelBody(val muted: Boolean? = null, val level: String? = null)

@Serializable
data class FcmClientConfig(
  val projectId: String = "",
  val applicationId: String = "",
  val apiKey: String = "",
  val senderId: String = "",
) {
  val ready: Boolean get() =
    projectId.isNotBlank() && applicationId.isNotBlank() && apiKey.isNotBlank() && senderId.isNotBlank()
}

@Serializable
data class FcmSubscribeBody(val platform: String, val token: String)

@Serializable
data class FcmUnsubscribeBody(val token: String)

@Serializable
data class AndroidRelease(
  val versionCode: Int,
  val versionName: String = "",
  val url: String = "",
  val requiresReinstall: Boolean = false,
  val releaseNotes: String = "",
)

@Serializable
data class DeviceSession(
  val id: String,
  val userAgent: String? = null,
  val ip: String? = null,
  val current: Boolean = false,
  val createdAt: String = "",
  val lastUsedAt: String = "",
)

@Serializable
data class ReceiptUpdate(
  val conversationId: String,
  val userId: String,
  val lastReadMessageId: String = "",
  val lastReadAt: String? = null,
)

@Serializable
data class TotpLoginBody(val ticket: String, val code: String)

@Serializable
data class QrApproveBody(val ticket: String)

@Serializable
data class QrApproveResponse(val ok: Boolean = true)

@Serializable
data class TotpCodeBody(val code: String)

@Serializable
data class TotpDisableBody(val code: String, val password: String)

@Serializable
data class TotpSetup(
  val secret: String = "",
  val otpauthUrl: String = "",
  val qrDataUrl: String = "",
)

@Serializable
data class FriendRequest(
  val id: String,
  val createdAt: String = "",
  val from: PublicUser,
  val to: PublicUser,
)

@Serializable
data class FriendRequestBody(val userId: String? = null, val username: String? = null)

@Serializable
data class CountBody(val count: Int = 0)

@Serializable
data class ChatMediaItem(
  val id: String,
  val messageId: String = "",
  val url: String = "",
  val filename: String = "",
  val contentType: String = "",
  val width: Int? = null,
  val height: Int? = null,
  val spoiler: Boolean = false,
  val createdAt: String = "",
) {
  val isImage: Boolean get() = contentType.startsWith("image/")
  val isVideo: Boolean get() = contentType.startsWith("video/")
}

@Serializable
data class MediaPage(
  val items: List<ChatMediaItem> = emptyList(),
  val hasMore: Boolean = false,
)

@Serializable
data class ReportAttachmentSnapshot(
  val url: String = "",
  val filename: String = "",
  val contentType: String = "",
  val spoiler: Boolean = false,
)

@Serializable
data class MessageReport(
  val id: String,
  val messageId: String? = null,
  val reporter: PublicUser,
  val target: PublicUser,
  val comment: String = "",
  val status: String = "pending",
  val createdAt: String = "",
  val resolvedAt: String? = null,
  val messageContent: String = "",
  val messageCreatedAt: String = "",
  val attachments: List<ReportAttachmentSnapshot> = emptyList(),
  val ban: SiteBan? = null,
)

@Serializable
data class SiteBan(
  val id: String,
  val user: PublicUser,
  val reason: String = "",
  val expiresAt: String? = null,
  val createdAt: String = "",
  val liftedAt: String? = null,
)

@Serializable
data class AdminCredentials(
  val login: String = "",
  val password: String = "",
  val expiresAt: String = "",
  val dateKey: String = "",
)

@Serializable
data class AdminSession(
  val accessToken: String,
  val expiresAt: String = "",
)

@Serializable
data class ReportBody(val messageId: String, val comment: String)

@Serializable
data class BanActionBody(val durationHours: Int? = null, val message: String)

@Serializable
data class AdminLoginBody(val login: String, val password: String)

@Serializable
data class FriendIncomingEvent(val count: Int = 0)

@Serializable
data class FriendAcceptedEvent(val conversation: DirectConversation)

enum class CallPhase {
  Idle,
  Outgoing,
  Ringing,
  Connecting,
  Active,
}

@Serializable
data class CallParticipant(
  val id: String,
  val username: String,
  val displayName: String? = null,
  val avatarUrl: String? = null,
) {
  val label: String get() = displayName?.takeIf { it.isNotBlank() } ?: username

  fun asPublicUser(): PublicUser = PublicUser(
    id = id,
    username = username,
    displayName = displayName,
    avatarUrl = avatarUrl,
  )
}

@Serializable
data class CallStartBody(val conversationId: String)

@Serializable
data class CallStartResponse(
  val callId: String,
  val roomName: String,
  val livekitUrl: String,
  val callee: CallParticipant,
)

@Serializable
data class CallSignalPayload(
  val callId: String,
  val conversationId: String,
  val roomName: String,
  val livekitUrl: String,
)

@Serializable
data class CallRingPayload(
  val callId: String,
  val conversationId: String,
  val roomName: String,
  val caller: CallParticipant,
  val startedAt: String = "",
)

@Serializable
data class CallTokenResponse(
  val token: String,
  val roomName: String,
  val livekitUrl: String,
)
