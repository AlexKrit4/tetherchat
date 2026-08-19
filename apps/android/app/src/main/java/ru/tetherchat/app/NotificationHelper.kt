package ru.tetherchat.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.RemoteInput
import androidx.core.content.ContextCompat

object NotificationHelper {
  const val CHANNEL_ID = "tetherchat.messages"
  const val FOREGROUND_CHANNEL_ID = "tetherchat.foreground"
  const val KEY_REPLY = "reply_text"
  const val EXTRA_MESSAGE_ID = "messageId"
  const val EXTRA_DM = "dm"
  const val EXTRA_NOTIFICATION_ID = "notificationId"
  private const val CHANNEL_NAME = "Сообщения"
  private const val FOREGROUND_CHANNEL_NAME = "Фоновые сообщения"

  fun areEnabled(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

  fun notificationId(channelId: String): Int =
    (channelId.hashCode() and 0x7fffffff).let { if (it == 42) it + 1 else it }

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Личные сообщения и упоминания"
          enableVibration(true)
        },
      )
    }
    if (manager.getNotificationChannel(FOREGROUND_CHANNEL_ID) == null) {
      manager.createNotificationChannel(
        NotificationChannel(FOREGROUND_CHANNEL_ID, FOREGROUND_CHANNEL_NAME, NotificationManager.IMPORTANCE_MIN).apply {
          description = "Держит соединение, пока приложение свёрнуто"
          setShowBadge(false)
        },
      )
    }
  }

  fun foregroundNotification(context: Context): Notification {
    ensureChannels(context)
    val open = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      },
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(context, FOREGROUND_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(context.getString(R.string.app_name))
      .setContentText(context.getString(R.string.foreground_waiting))
      .setContentIntent(open)
      .setOngoing(true)
      .setSilent(true)
      .setShowWhen(false)
      .setPriority(NotificationCompat.PRIORITY_MIN)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
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
}
