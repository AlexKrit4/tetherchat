package ru.tetherchat.app.data

import android.content.Context
import androidx.core.content.edit

class DraftStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun get(channelId: String): String = prefs.getString(channelId, "").orEmpty()

  fun set(channelId: String, text: String) {
    prefs.edit {
      if (text.isBlank()) remove(channelId) else putString(channelId, text)
    }
  }

  companion object {
    private const val PREFS = "tetherchat.drafts"

    @Volatile private var instance: DraftStore? = null

    fun get(context: Context): DraftStore {
      return instance ?: synchronized(this) {
        instance ?: DraftStore(context.applicationContext).also { instance = it }
      }
    }
  }
}
