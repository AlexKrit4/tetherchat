package ru.tetherchat.admin.data

import kotlinx.serialization.Serializable

@Serializable
data class ApiErrorBody(val code: String = "error", val message: String = "Ошибка")

class ApiException(val status: Int, override val message: String) : RuntimeException(message)

@Serializable
data class PublicUser(
  val id: String,
  val username: String,
  val displayName: String? = null,
  val avatarUrl: String? = null,
) {
  val label: String get() = displayName?.takeIf { it.isNotBlank() } ?: username
}

@Serializable
data class ReportAttachment(
  val url: String = "",
  val filename: String = "",
  val contentType: String = "",
  val spoiler: Boolean = false,
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
  val attachments: List<ReportAttachment> = emptyList(),
  val ban: SiteBan? = null,
)

@Serializable
data class AdminSession(val accessToken: String, val expiresAt: String = "")

@Serializable
data class LoginBody(val login: String, val password: String)

@Serializable
data class BanBody(val durationHours: Int? = null, val message: String)
