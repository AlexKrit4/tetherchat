package ru.tetherchat.app.data

import android.content.Context
import androidx.core.content.edit

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

  val hasSession: Boolean get() = !refreshToken.isNullOrBlank()

  fun save(auth: AuthResponse) {
    accessToken = auth.accessToken
    if (!auth.refreshToken.isNullOrBlank()) refreshToken = auth.refreshToken
    userId = auth.user.id
  }

  fun clear() {
    prefs.edit { clear() }
  }

  companion object {
    private const val PREFS = "tetherchat.session"
    private const val KEY_ACCESS = "access"
    private const val KEY_REFRESH = "refresh"
    private const val KEY_USER = "user"
    private const val LOCK = "session-store"

    @Volatile private var instance: SessionStore? = null

    fun get(context: Context): SessionStore {
      return instance ?: synchronized(LOCK) {
        instance ?: SessionStore(context.applicationContext).also { instance = it }
      }
    }
  }
}
