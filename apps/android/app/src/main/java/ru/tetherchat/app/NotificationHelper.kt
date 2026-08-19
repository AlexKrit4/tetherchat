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
import androidx.core.content.ContextCompat
import androidx.core.net.toUri

/** System notifications for messages received while the WebView is in the background. */
object NotificationHelper {
  const val CHANNEL_ID = "tetherchat.messages"
  const val FOREGROUND_CHANNEL_ID = "tetherchat.foreground"
  private const val CHANNEL_NAME = "Сообщения"
  private const val FOREGROUND_CHANNEL_NAME = "Фоновые сообщения"

  fun areEnabled(context: Context): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
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
        NotificationChannel(
          FOREGROUND_CHANNEL_ID,
          FOREGROUND_CHANNEL_NAME,
          NotificationManager.IMPORTANCE_MIN,
        ).apply {
          description = "Держит соединение, пока приложение свёрнуто"
          setShowBadge(false)
        },
      )
    }
  }

  @Deprecated("Use ensureChannels", ReplaceWith("ensureChannels(context)"))
  fun ensureChannel(context: Context) = ensureChannels(context)

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

  fun showMessage(context: Context, title: String, body: String, url: String) {
    notify(context, title, body, url)
  }

  fun notify(context: Context, title: String, body: String, url: String) {
    if (!areEnabled(context)) {
      return
    }
    ensureChannels(context)

    val target = if (url.startsWith("https://")) url else "${BuildConfig.WEB_URL.trimEnd('/')}$url"
    val open = Intent(context, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      data = target.toUri()
    }
    val pending = PendingIntent.getActivity(
      context,
      target.hashCode(),
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
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setDefaults(NotificationCompat.DEFAULT_ALL)
      .build()

    val id = (target.hashCode() and 0x7fffffff).let { if (it == 42) it + 1 else it }
    try {
      NotificationManagerCompat.from(context).notify(id, notification)
    } catch (_: SecurityException) {
    }
  }
}
