package ru.tetherchat.app.data

import android.content.Context
import androidx.core.content.edit
import org.json.JSONObject

data class AccountSlot(
  val refreshToken: String,
  val accessToken: String? = null,
  val userId: String,
  val username: String = "",
  val displayName: String? = null,
  val avatarUrl: String? = null,
  val isPlus: Boolean = false,
) {
  val label: String get() = displayName?.takeIf { it.isNotBlank() } ?: username
}

class SessionStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  var accessToken: String?
    get() = prefs.getString(KEY_ACCESS, null)
    set(value) = prefs.edit { putString(KEY_ACCESS, value) }

  var refreshToken: String?
    get() = prefs.getString(KEY_REFRESH, null)
    set(value) = prefs.edit { putString(KEY_REFRESH, value) }

  var userId: String?
    get() = prefs.getString(KEY_USER, null)
    set(value) = prefs.edit { putString(KEY_USER, value) }

  var fcmToken: String?
    get() = prefs.getString(KEY_FCM, null)
    set(value) = prefs.edit { putString(KEY_FCM, value) }

  var notificationsEnabled: Boolean
    get() = prefs.getBoolean(KEY_NOTIFICATIONS, true)
    set(value) = prefs.edit { putBoolean(KEY_NOTIFICATIONS, value) }

  val hasSession: Boolean get() = !refreshToken.isNullOrBlank()

  var pendingAddAccount: Boolean
    get() = prefs.getBoolean(KEY_PENDING_ADD, false)
    set(value) = prefs.edit { putBoolean(KEY_PENDING_ADD, value) }

  fun otherAccount(): AccountSlot? {
    val raw = prefs.getString(KEY_OTHER, null) ?: return null
    return runCatching {
      val obj = JSONObject(raw)
      AccountSlot(
        refreshToken = obj.getString("refreshToken"),
        accessToken = obj.optString("accessToken").ifBlank { null },
        userId = obj.getString("userId"),
        username = obj.optString("username"),
        displayName = obj.optString("displayName").ifBlank { null },
        avatarUrl = obj.optString("avatarUrl").ifBlank { null },
        isPlus = obj.optBoolean("isPlus"),
      )
    }.getOrNull()
  }

  fun save(auth: AuthResponse) {
    val token = auth.accessToken ?: return
    val user = auth.user ?: return
    if (pendingAddAccount) {
      stashCurrentAsOther()
      pendingAddAccount = false
    }
    accessToken = token
    if (!auth.refreshToken.isNullOrBlank()) refreshToken = auth.refreshToken
    userId = user.id
    prefs.edit {
      putString(KEY_CURRENT_NAME, user.label)
      putString(KEY_CURRENT_AVATAR, user.avatarUrl)
      putBoolean(KEY_CURRENT_PLUS, user.isPlus)
    }
  }

  fun currentAsSlot(): AccountSlot? {
    val refresh = refreshToken ?: return null
    val id = userId ?: return null
    return AccountSlot(
      refreshToken = refresh,
      accessToken = accessToken,
      userId = id,
      username = prefs.getString(KEY_CURRENT_NAME, "") ?: "",
      displayName = prefs.getString(KEY_CURRENT_NAME, "") ?: "",
      avatarUrl = prefs.getString(KEY_CURRENT_AVATAR, null),
      isPlus = prefs.getBoolean(KEY_CURRENT_PLUS, false),
    )
  }

  fun saveOther(slot: AccountSlot) {
    val obj = JSONObject()
      .put("refreshToken", slot.refreshToken)
      .put("accessToken", slot.accessToken)
      .put("userId", slot.userId)
      .put("username", slot.username)
      .put("displayName", slot.displayName)
      .put("avatarUrl", slot.avatarUrl)
      .put("isPlus", slot.isPlus)
    prefs.edit { putString(KEY_OTHER, obj.toString()) }
  }

  fun switchSlots(): Boolean {
    val previous = currentAsSlot() ?: return false
    val other = otherAccount() ?: return false
    accessToken = other.accessToken
    refreshToken = other.refreshToken
    userId = other.userId
    prefs.edit {
      putString(KEY_CURRENT_NAME, other.label)
      putString(KEY_CURRENT_AVATAR, other.avatarUrl)
      putBoolean(KEY_CURRENT_PLUS, other.isPlus)
    }
    saveOther(previous)
    return true
  }

  private fun stashCurrentAsOther() {
    val refresh = refreshToken ?: return
    val id = userId ?: return
    val obj = JSONObject()
      .put("refreshToken", refresh)
      .put("accessToken", accessToken)
      .put("userId", id)
      .put("username", prefs.getString(KEY_CURRENT_NAME, "") ?: "")
      .put("displayName", prefs.getString(KEY_CURRENT_NAME, "") ?: "")
      .put("avatarUrl", prefs.getString(KEY_CURRENT_AVATAR, "") ?: "")
      .put("isPlus", prefs.getBoolean(KEY_CURRENT_PLUS, false))
    prefs.edit { putString(KEY_OTHER, obj.toString()) }
  }

  fun promoteOther(): AccountSlot? {
    val other = otherAccount() ?: return null
    prefs.edit { remove(KEY_OTHER) }
    accessToken = other.accessToken
    refreshToken = other.refreshToken
    userId = other.userId
    prefs.edit {
      putString(KEY_CURRENT_NAME, other.label)
      putString(KEY_CURRENT_AVATAR, other.avatarUrl)
      putBoolean(KEY_CURRENT_PLUS, other.isPlus)
    }
    return other
  }

  fun clearActiveKeepOther() {
    val keepNotifications = notificationsEnabled
    val fcm = fcmToken
    val other = prefs.getString(KEY_OTHER, null)
    prefs.edit { clear() }
    notificationsEnabled = keepNotifications
    fcmToken = fcm
    if (other != null) prefs.edit { putString(KEY_OTHER, other) }
  }

  fun clear() {
    val keepNotifications = notificationsEnabled
    prefs.edit { clear() }
    notificationsEnabled = keepNotifications
  }

  companion object {
    private const val PREFS = "tetherchat.session"
    private const val KEY_ACCESS = "access"
    private const val KEY_REFRESH = "refresh"
    private const val KEY_USER = "user"
    private const val KEY_FCM = "fcm"
    private const val KEY_NOTIFICATIONS = "notifications"
    private const val KEY_OTHER = "other_slot"
    private const val KEY_PENDING_ADD = "pending_add"
    private const val KEY_CURRENT_NAME = "current_name"
    private const val KEY_CURRENT_AVATAR = "current_avatar"
    private const val KEY_CURRENT_PLUS = "current_plus"
    private const val LOCK = "session-store"

    @Volatile private var instance: SessionStore? = null

    fun get(context: Context): SessionStore {
      return instance ?: synchronized(LOCK) {
        instance ?: SessionStore(context.applicationContext).also { instance = it }
      }
    }
  }
}
