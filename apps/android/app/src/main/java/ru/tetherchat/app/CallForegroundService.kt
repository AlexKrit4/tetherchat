package ru.tetherchat.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

class CallForegroundService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val callId = intent?.getStringExtra(NotificationHelper.EXTRA_CALL_ID)
    if (callId.isNullOrBlank()) {
      stopSelf()
      return START_NOT_STICKY
    }
    val conversationId = intent.getStringExtra(MainActivity.EXTRA_CHANNEL_ID).orEmpty()
    val peerName = intent.getStringExtra(EXTRA_PEER_NAME).orEmpty()
    val connectedAt = intent.getLongExtra(EXTRA_CONNECTED_AT, System.currentTimeMillis())
    val muted = intent.getBooleanExtra(EXTRA_MUTED, false)
    val notification = NotificationHelper.ongoingCallNotification(
      this,
      callId,
      conversationId,
      peerName,
      connectedAt,
      muted,
    )
    if (Build.VERSION.SDK_INT >= 34) {
      ServiceCompat.startForeground(
        this,
        NotificationHelper.callNotificationId(callId),
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE,
      )
    } else {
      startForeground(NotificationHelper.callNotificationId(callId), notification)
    }
    return START_NOT_STICKY
  }

  companion object {
    private const val EXTRA_PEER_NAME = "peerName"
    private const val EXTRA_CONNECTED_AT = "connectedAt"
    private const val EXTRA_MUTED = "muted"

    fun start(
      context: Context,
      callId: String,
      conversationId: String,
      peerName: String,
      connectedAt: Long,
      muted: Boolean,
    ) {
      val intent = Intent(context, CallForegroundService::class.java).apply {
        putExtra(NotificationHelper.EXTRA_CALL_ID, callId)
        putExtra(MainActivity.EXTRA_CHANNEL_ID, conversationId)
        putExtra(EXTRA_PEER_NAME, peerName)
        putExtra(EXTRA_CONNECTED_AT, connectedAt)
        putExtra(EXTRA_MUTED, muted)
      }
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, CallForegroundService::class.java))
    }
  }
}
