package ru.tetherchat.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import ru.tetherchat.app.ui.AppViewModel
import ru.tetherchat.app.ui.TetherRoot
import ru.tetherchat.app.ui.TetherTheme

class MainActivity : ComponentActivity() {
  private val model by viewModels<AppViewModel>()
  private var pendingMicCallback: ((Boolean) -> Unit)? = null

  private val notificationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission(),
  ) { granted ->
    if (granted) PushRegistrar.sync(this)
  }

  private val micPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission(),
  ) { granted ->
    pendingMicCallback?.invoke(granted)
    pendingMicCallback = null
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    enableEdgeToEdge()
    lifecycle.addObserver(model)
    NotificationHelper.ensureChannels(this)
    requestNotificationPermissionIfNeeded()
    model.micPermissionHandler = { callback ->
      when {
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
          PackageManager.PERMISSION_GRANTED -> callback(true)
        else -> {
          pendingMicCallback = callback
          micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
      }
    }
    PushRegistrar.sync(this)
    applyDeepLink(intent)
    intent.getStringExtra(EXTRA_ACCEPT_CALL_ID)?.let { callId ->
      val channelId = intent.getStringExtra(EXTRA_CHANNEL_ID)
      model.handleIncomingCallDeepLink(callId, channelId)
      model.acceptIncomingCall()
    }
    setContent {
      TetherTheme { TetherRoot(model) }
    }
  }

  override fun onResume() {
    super.onResume()
    model.resumePendingInstall()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    applyDeepLink(intent)
  }

  private fun applyDeepLink(intent: Intent?) {
    intent ?: return
    val extraId = intent.getStringExtra(EXTRA_CHANNEL_ID)
    if (!extraId.isNullOrBlank()) {
      val serverId = intent.getStringExtra(EXTRA_SERVER_ID)
      val title = intent.getStringExtra(EXTRA_CHAT_TITLE) ?: "Чат"
      model.openChat(extraId, serverId, title, dm = serverId.isNullOrBlank())
      return
    }
    val data = intent.data ?: return
    val path = data.path.orEmpty()
    val token = data.getQueryParameter("token")
    val parts = data.pathSegments.orEmpty()
    if (parts.getOrNull(0) == "qr-login" || path == "/qr-login") {
      val ticket = data.getQueryParameter("ticket")
      if (!ticket.isNullOrBlank()) {
        model.promptQrLogin(ticket)
      }
      return
    }
    if (parts.getOrNull(0) == "channels") {
      val first = parts.getOrNull(1) ?: return
      val second = parts.getOrNull(2)
      val callId = data.getQueryParameter("call")
      when {
        first == "@me" && !second.isNullOrBlank() -> {
          model.openChat(second, null, "Чат", true)
          if (!callId.isNullOrBlank()) model.handleIncomingCallDeepLink(callId, second)
        }
        !second.isNullOrBlank() -> model.openChat(second, first, "Чат", false)
      }
      return
    }
    if (path.isNotBlank()) model.openDeepLink(path, token)
  }

  fun requestNotificationPermission() {
    requestNotificationPermissionIfNeeded()
  }

  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
    ) {
      PushRegistrar.sync(this)
      return
    }
    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
  }

  companion object {
    const val EXTRA_CHANNEL_ID = "channelId"
    const val EXTRA_SERVER_ID = "serverId"
    const val EXTRA_CHAT_TITLE = "chatTitle"
    const val EXTRA_ACCEPT_CALL_ID = "acceptCallId"
  }
}
