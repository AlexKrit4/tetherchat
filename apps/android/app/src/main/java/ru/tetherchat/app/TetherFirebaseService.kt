package ru.tetherchat.app

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import ru.tetherchat.app.data.SessionStore

class TetherFirebaseService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    val session = SessionStore.get(this)
    session.fcmToken = token
    if (session.notificationsEnabled) PushRegistrar.sync(this)
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    val kind = data["kind"] ?: "message"
    if (kind == "call") {
      if (ForegroundState.inForeground) return
      val callId = data["callId"].orEmpty()
      val conversationId = data["channelId"].orEmpty()
      val callerName = data["callerName"].orEmpty().ifBlank { data["title"].orEmpty() }
      if (callId.isBlank() || conversationId.isBlank()) return
      NotificationHelper.showIncomingCall(this, callId, conversationId, callerName)
      return
    }

    if (ForegroundState.inForeground) return
    val title = data["title"].orEmpty().ifBlank { message.notification?.title.orEmpty() }
    val body = data["body"].orEmpty().ifBlank { message.notification?.body.orEmpty() }
    val channelId = data["channelId"].orEmpty()
    if (channelId.isBlank() || (title.isBlank() && body.isBlank())) return
    val serverId = data["serverId"]?.takeIf { it.isNotBlank() }
    NotificationHelper.showMessage(
      this,
      title.ifBlank { getString(R.string.app_name) },
      body.ifBlank { "Новое сообщение" },
      channelId,
      serverId,
      title.ifBlank { getString(R.string.app_name) },
      data["messageId"].orEmpty(),
    )
  }
}
