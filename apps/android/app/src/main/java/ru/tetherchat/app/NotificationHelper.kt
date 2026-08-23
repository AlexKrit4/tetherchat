package ru.tetherchat.app

import android.app.NotificationChannel
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat
import ru.tetherchat.app.data.SessionStore

object NotificationHelper {
  const val CHANNEL_ID = "tetherchat.messages"
  const val CALLS_CHANNEL_ID = "tetherchat.calls"
  const val KEY_REPLY = "reply_text"
  const val EXTRA_MESSAGE_ID = "messageId"
  const val EXTRA_CALL_ID = "callId"
  const val EXTRA_DM = "dm"
  const val EXTRA_NOTIFICATION_ID = "notificationId"
  private const val CHANNEL_NAME = "Сообщения"
  private const val CALLS_CHANNEL_NAME = "Звонки"

  fun areEnabled(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

  fun notificationId(channelId: String): Int =
    (channelId.hashCode() and 0x7fffffff).let { if (it == 42) it + 1 else it }

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    manager.deleteNotificationChannel("tetherchat.foreground")
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Личные сообщения и упоминания"
          enableVibration(true)
        },
      )
    }
    if (manager.getNotificationChannel(CALLS_CHANNEL_ID) == null) {
      manager.createNotificationChannel(
        NotificationChannel(CALLS_CHANNEL_ID, CALLS_CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Входящие голосовые звонки"
          enableVibration(true)
          setBypassDnd(true)
        },
      )
    }
  }

  fun callNotificationId(callId: String): Int = (callId.hashCode() and 0x7fffffff).let { if (it == 42) it + 1 else it }

  fun showIncomingCall(
    context: Context,
    callId: String,
    conversationId: String,
    callerName: String,
  ) {
    if (!SessionStore.get(context).notificationsEnabled) return
    if (!areEnabled(context)) return
    ensureChannels(context)
    val id = callNotificationId(callId)
    val open = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      data = android.net.Uri.parse("https://tetherchat.ru/channels/@me/$conversationId?call=$callId")
    }
    val pending = PendingIntent.getActivity(
      context,
      callId.hashCode(),
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val acceptIntent = Intent(context, NotificationActionReceiver::class.java).apply {
      action = NotificationActionReceiver.ACTION_ACCEPT_CALL
      putExtra(EXTRA_CALL_ID, callId)
      putExtra(MainActivity.EXTRA_CHANNEL_ID, conversationId)
      putExtra(EXTRA_NOTIFICATION_ID, id)
    }
    val acceptPending = PendingIntent.getBroadcast(
      context,
      callId.hashCode() + 3,
      acceptIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val declineIntent = Intent(context, NotificationActionReceiver::class.java).apply {
      action = NotificationActionReceiver.ACTION_DECLINE_CALL
      putExtra(EXTRA_CALL_ID, callId)
      putExtra(EXTRA_NOTIFICATION_ID, id)
    }
    val declinePending = PendingIntent.getBroadcast(
      context,
      callId.hashCode() + 7,
      declineIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(context, CALLS_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setColor(ContextCompat.getColor(context, R.color.brand))
      .setContentTitle("Входящий звонок")
      .setContentText(callerName.ifBlank { context.getString(R.string.app_name) })
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .addAction(R.drawable.ic_stat_notify, "Принять", acceptPending)
      .addAction(R.drawable.ic_stat_notify, "Отклонить", declinePending)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(id, notification)
    } catch (_: SecurityException) {
    }
  }

  fun cancelCall(context: Context, callId: String) {
    cancel(context, callNotificationId(callId))
  }

  fun ongoingCallNotification(
    context: Context,
    callId: String,
    conversationId: String,
    peerName: String,
    connectedAt: Long,
    muted: Boolean,
  ): Notification {
    ensureChannels(context)
    val id = callNotificationId(callId)
    val open = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra(MainActivity.EXTRA_CHANNEL_ID, conversationId)
      putExtra(MainActivity.EXTRA_RESTORE_CALL, true)
    }
    val openPending = PendingIntent.getActivity(
      context,
      callId.hashCode() + 19,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    fun actionPending(action: String, offset: Int): PendingIntent {
      val actionIntent = Intent(context, NotificationActionReceiver::class.java).apply {
        this.action = action
        putExtra(EXTRA_CALL_ID, callId)
        putExtra(MainActivity.EXTRA_CHANNEL_ID, conversationId)
        putExtra(EXTRA_NOTIFICATION_ID, id)
      }
      return PendingIntent.getBroadcast(
        context,
        callId.hashCode() + offset,
        actionIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    return NotificationCompat.Builder(context, CALLS_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setColor(ContextCompat.getColor(context, R.color.brand))
      .setContentTitle("Текущий вызов")
      .setContentText(peerName.ifBlank { context.getString(R.string.app_name) })
      .setContentIntent(openPending)
      .setWhen(connectedAt)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .addAction(
        R.drawable.ic_stat_notify,
        if (muted) "Включить микрофон" else "Выключить микрофон",
        actionPending(NotificationActionReceiver.ACTION_MUTE_CALL, 23),
      )
      .addAction(
        R.drawable.ic_stat_notify,
        "Завершить",
        actionPending(NotificationActionReceiver.ACTION_HANGUP_CALL, 29),
      )
      .build()
  }

  fun updateOngoingCall(
    context: Context,
    callId: String,
    conversationId: String,
    peerName: String,
    connectedAt: Long,
    muted: Boolean,
  ) {
    try {
      NotificationManagerCompat.from(context).notify(
        callNotificationId(callId),
        ongoingCallNotification(context, callId, conversationId, peerName, connectedAt, muted),
      )
    } catch (_: SecurityException) {
    }
  }

  fun showMessage(
    context: Context,
    title: String,
    body: String,
    channelId: String,
    serverId: String?,
    chatTitle: String,
    messageId: String,
  ) {
    if (!SessionStore.get(context).notificationsEnabled) return
    if (!areEnabled(context) || ForegroundState.inForeground) return
    ensureChannels(context)
    val dm = serverId.isNullOrBlank()
    val id = notificationId(channelId)
    val open = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra(MainActivity.EXTRA_CHANNEL_ID, channelId)
      putExtra(MainActivity.EXTRA_SERVER_ID, serverId)
      putExtra(MainActivity.EXTRA_CHAT_TITLE, chatTitle)
    }
    val pending = PendingIntent.getActivity(
      context,
      channelId.hashCode(),
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val replyRemote = RemoteInput.Builder(KEY_REPLY)
      .setLabel(context.getString(R.string.notif_reply))
      .build()
    val replyIntent = Intent(context, NotificationActionReceiver::class.java).apply {
      action = NotificationActionReceiver.ACTION_REPLY
      putExtra(MainActivity.EXTRA_CHANNEL_ID, channelId)
      putExtra(MainActivity.EXTRA_SERVER_ID, serverId)
      putExtra(EXTRA_MESSAGE_ID, messageId)
      putExtra(EXTRA_DM, dm)
      putExtra(EXTRA_NOTIFICATION_ID, id)
    }
    val replyPending = PendingIntent.getBroadcast(
      context,
      channelId.hashCode() + 11,
      replyIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
    )
    val replyAction = NotificationCompat.Action.Builder(
      R.drawable.ic_stat_notify,
      context.getString(R.string.notif_reply),
      replyPending,
    ).addRemoteInput(replyRemote).setAllowGeneratedReplies(true).build()

    val readIntent = Intent(context, NotificationActionReceiver::class.java).apply {
      action = NotificationActionReceiver.ACTION_MARK_READ
      putExtra(MainActivity.EXTRA_CHANNEL_ID, channelId)
      putExtra(EXTRA_MESSAGE_ID, messageId)
      putExtra(EXTRA_DM, dm)
      putExtra(EXTRA_NOTIFICATION_ID, id)
    }
    val readPending = PendingIntent.getBroadcast(
      context,
      channelId.hashCode() + 17,
      readIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val readAction = NotificationCompat.Action.Builder(
      R.drawable.ic_stat_notify,
      context.getString(R.string.notif_mark_read),
      readPending,
    ).build()

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setColor(ContextCompat.getColor(context, R.color.brand))
      .setContentTitle(title.ifBlank { context.getString(R.string.app_name) })
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .addAction(replyAction)
      .addAction(readAction)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(id, notification)
    } catch (_: SecurityException) {
    }
  }

  fun cancel(context: Context, notificationId: Int) {
    NotificationManagerCompat.from(context).cancel(notificationId)
  }

  fun cancelAll(context: Context) {
    NotificationManagerCompat.from(context).cancelAll()
  }

  fun foregroundNotification(context: Context) =
    NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setColor(ContextCompat.getColor(context, R.color.brand))
      .setContentTitle(context.getString(R.string.app_name))
      .setContentText("Синхронизация сообщений")
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

  fun notify(context: Context, title: String, body: String, url: String) {
    if (!SessionStore.get(context).notificationsEnabled) return
    if (!areEnabled(context) || ForegroundState.inForeground) return
    ensureChannels(context)
    val open = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      data = android.net.Uri.parse("https://tetherchat.ru$url")
    }
    val pending = PendingIntent.getActivity(
      context,
      url.hashCode(),
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setColor(ContextCompat.getColor(context, R.color.brand))
      .setContentTitle(title.ifBlank { context.getString(R.string.app_name) })
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(url.hashCode(), notification)
    } catch (_: SecurityException) {
    }
  }
}
