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
  val accessToken: String,
  val expiresIn: Int = 900,
  val refreshToken: String? = null,
  val user: SelfUser,
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
)

@Serializable
data class ServerMember(
  val userId: String,
  val serverId: String = "",
  val nickname: String? = null,
  val joinedAt: String = "",
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
) {
  val isImage: Boolean get() = contentType.startsWith("image/")
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
data class Message(
  val id: String,
  val channelId: String,
  val serverId: String? = null,
  val authorId: String,
  val author: PublicUser,
  val content: String = "",
  val createdAt: String = "",
  val editedAt: String? = null,
  val pinned: Boolean = false,
  val system: Boolean = false,
  val replyTo: MessageReference? = null,
  val attachments: List<Attachment> = emptyList(),
  val reactions: List<Reaction> = emptyList(),
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
  val name: String? = null,
  val iconUrl: String? = null,
  val ownerId: String? = null,
  val members: List<PublicUser> = emptyList(),
  val lastMessageAt: String? = null,
) {
  fun title(meId: String): String {
    if (isGroup) return name?.takeIf { it.isNotBlank() } ?: members.joinToString { it.label }
    return members.firstOrNull { it.id != meId }?.label ?: "Личные сообщения"
  }

  fun peer(meId: String): PublicUser? = members.firstOrNull { it.id != meId }
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
)
