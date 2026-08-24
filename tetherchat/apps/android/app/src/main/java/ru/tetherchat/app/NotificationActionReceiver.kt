package ru.tetherchat.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.RemoteInput
import ru.tetherchat.app.data.SessionStore
import ru.tetherchat.app.data.TetherApi
import java.util.UUID

class NotificationActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val pending = goAsync()
    Thread {
      try {
        handle(context.applicationContext, intent)
      } finally {
        pending.finish()
      }
    }.start()
  }

  private fun handle(context: Context, intent: Intent) {
    val channelId = intent.getStringExtra(MainActivity.EXTRA_CHANNEL_ID) ?: return
    val messageId = intent.getStringExtra(NotificationHelper.EXTRA_MESSAGE_ID).orEmpty()
    val dm = intent.getBooleanExtra(NotificationHelper.EXTRA_DM, true)
    val notificationId = intent.getIntExtra(NotificationHelper.EXTRA_NOTIFICATION_ID, NotificationHelper.notificationId(channelId))
    val store = SessionStore.get(context)
    if (!store.hasSession) return
    val api = TetherApi(store)
    when (intent.action) {
      ACTION_REPLY -> {
        val text = RemoteInput.getResultsFromIntent(intent)
          ?.getCharSequence(NotificationHelper.KEY_REPLY)
          ?.toString()
          ?.trim()
          .orEmpty()
        if (text.isEmpty()) return
        runCatching {
          api.send(channelId, text, dm, UUID.randomUUID().toString())
          if (messageId.isNotBlank()) runCatching { api.ack(channelId, messageId, dm) }
        }
        NotificationHelper.cancel(context, notificationId)
      }
      ACTION_MARK_READ -> {
        if (messageId.isNotBlank()) runCatching { api.ack(channelId, messageId, dm) }
        NotificationHelper.cancel(context, notificationId)
      }
    }
  }

  companion object {
    const val ACTION_REPLY = "ru.tetherchat.app.REPLY"
    const val ACTION_MARK_READ = "ru.tetherchat.app.MARK_READ"
  }
}
