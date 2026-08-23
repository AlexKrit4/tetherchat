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
      ACTION_ACCEPT_CALL -> {
        val callId = intent.getStringExtra(NotificationHelper.EXTRA_CALL_ID) ?: return
        val channelId = intent.getStringExtra(MainActivity.EXTRA_CHANNEL_ID).orEmpty()
        NotificationHelper.cancel(context, notificationId)
        val launch = Intent(context, MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
          putExtra(MainActivity.EXTRA_CHANNEL_ID, channelId)
          putExtra(MainActivity.EXTRA_ACCEPT_CALL_ID, callId)
        }
        context.startActivity(launch)
      }
      ACTION_DECLINE_CALL -> {
        val callId = intent.getStringExtra(NotificationHelper.EXTRA_CALL_ID) ?: return
        runCatching { api.declineCall(callId) }
        NotificationHelper.cancelCall(context, callId)
      }
      ACTION_MUTE_CALL -> {
        CallActionBus.mute()
      }
      ACTION_HANGUP_CALL -> {
        val callId = intent.getStringExtra(NotificationHelper.EXTRA_CALL_ID) ?: return
        if (!CallActionBus.hangup()) {
          runCatching { api.endCall(callId) }
          NotificationHelper.cancelCall(context, callId)
          CallForegroundService.stop(context)
        }
      }
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
    const val ACTION_ACCEPT_CALL = "ru.tetherchat.app.ACCEPT_CALL"
    const val ACTION_DECLINE_CALL = "ru.tetherchat.app.DECLINE_CALL"
    const val ACTION_MUTE_CALL = "ru.tetherchat.app.MUTE_CALL"
    const val ACTION_HANGUP_CALL = "ru.tetherchat.app.HANGUP_CALL"
  }
}
