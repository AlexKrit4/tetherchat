package ru.tetherchat.app

import android.app.Notification
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log
import androidx.core.app.ServiceCompat
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.net.URI

class MessagePushService : Service() {
  private var socket: Socket? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private var worker: Thread? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    NotificationHelper.ensureChannels(this)
    enterForeground()
    acquireWakeLock()
    worker = Thread(::connectSocket, "tetherchat-push").also { it.start() }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    NotificationHelper.ensureChannels(this)
    enterForeground()
    if (socket?.connected() != true && worker?.isAlive != true) {
      worker = Thread(::connectSocket, "tetherchat-push").also { it.start() }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    releaseWakeLock()
    disconnectSocket()
    super.onDestroy()
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    super.onTaskRemoved(rootIntent)
  }

  private fun enterForeground() {
    val notification = NotificationHelper.foregroundNotification(this)
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        ServiceCompat.startForeground(
          this,
          FOREGROUND_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_REMOTE_MESSAGING,
        )
      } else {
        startForeground(FOREGROUND_ID, notification)
      }
    } catch (error: Exception) {
      Log.e(TAG, "unable to enter foreground", error)
      stopSelf()
    }
  }

  private fun acquireWakeLock() {
    val manager = getSystemService(POWER_SERVICE) as PowerManager
    wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tetherchat:push").apply {
      setReferenceCounted(false)
      acquire(4 * 60 * 60 * 1000L)
    }
  }

  private fun releaseWakeLock() {
    try {
      if (wakeLock?.isHeld == true) wakeLock?.release()
    } catch (_: Exception) {
    }
    wakeLock = null
  }

  private fun connectSocket() {
    val token = SessionRefresh.accessToken(BuildConfig.WEB_URL)
    if (token.isNullOrBlank()) {
      Log.w(TAG, "no session; stopping")
      stopSelf()
      return
    }
    val options = IO.Options().apply {
      path = "/socket.io"
      transports = arrayOf("websocket")
      forceNew = true
      reconnection = true
      reconnectionDelay = 2_000
      reconnectionDelayMax = 20_000
      query = "silent=1"
      auth = hashMapOf("token" to token, "silent" to "true")
    }
    val next = IO.socket(URI.create(BuildConfig.WEB_URL), options)
    next.on("message:new") { args ->
      val message = args.firstOrNull() as? JSONObject ?: return@on
      showIncoming(message, token)
    }
    next.on(Socket.EVENT_CONNECT_ERROR) { args ->
      Log.w(TAG, "socket error ${args.firstOrNull()}")
    }
    next.connect()
    socket = next
  }

  private fun showIncoming(message: JSONObject, token: String) {
    val author = message.optJSONObject("author")
    val authorId = author?.optString("id").orEmpty()
    if (authorId.isNotBlank() && authorId == currentUserId(token)) return
    val title = author?.optString("displayName")
      ?.ifBlank { null }
      ?: author?.optString("username")
      ?: "TetherChat"
    val attachments = message.optJSONArray("attachments")?.length() ?: 0
    val body = message.optString("content").ifBlank {
      if (attachments > 0) "Вложение" else "Новое сообщение"
    }
    val channelId = message.optString("channelId")
    val serverId = message.optString("serverId")
    val url = when {
      channelId.isBlank() -> "/"
      serverId.isNotBlank() && serverId != "null" -> "/channels/$serverId/$channelId"
      else -> "/channels/@me/$channelId"
    }
    NotificationHelper.showMessage(this, title, body, url)
  }

  private fun disconnectSocket() {
    socket?.off()
    socket?.disconnect()
    socket = null
  }

  private fun currentUserId(token: String): String? {
    return try {
      val payload = token.split(".").getOrNull(1) ?: return null
      val padded = payload + "=".repeat((4 - payload.length % 4) % 4)
      val json = JSONObject(String(android.util.Base64.decode(padded, android.util.Base64.URL_SAFE)))
      json.optString("sub").ifBlank { null }
    } catch (_: Exception) {
      null
    }
  }

  companion object {
    private const val TAG = "MessagePushService"
    const val FOREGROUND_ID = 42
  }
}
