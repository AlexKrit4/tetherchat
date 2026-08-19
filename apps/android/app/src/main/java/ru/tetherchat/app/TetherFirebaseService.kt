package ru.tetherchat.app

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import ru.tetherchat.app.data.SessionStore

class TetherFirebaseService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    SessionStore.get(this).fcmToken = token
    PushRegistrar.sync(this)
  }

  override fun onMessageReceived(message: RemoteMessage) {
    if (ForegroundState.inForeground) return
    val data = message.data
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
