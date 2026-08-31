package ru.tetherchat.admin.data

import android.content.Context
import androidx.core.content.edit

class SessionStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  var accessToken: String?
    get() = prefs.getString(KEY_TOKEN, null)
    set(value) = prefs.edit { putString(KEY_TOKEN, value) }

  var expiresAt: String?
    get() = prefs.getString(KEY_EXPIRES, null)
    set(value) = prefs.edit { putString(KEY_EXPIRES, value) }

  val hasSession: Boolean get() = !accessToken.isNullOrBlank()

  fun save(session: AdminSession) {
    accessToken = session.accessToken
    expiresAt = session.expiresAt
  }

  fun clear() = prefs.edit { clear() }

  companion object {
    private const val PREFS = "tetherchat.admin"
    private const val KEY_TOKEN = "token"
    private const val KEY_EXPIRES = "expires"
    @Volatile private var instance: SessionStore? = null
    fun get(context: Context): SessionStore =
      instance ?: synchronized(this) { instance ?: SessionStore(context).also { instance = it } }
  }
}
