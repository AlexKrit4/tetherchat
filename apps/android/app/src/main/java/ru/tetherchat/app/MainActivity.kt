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

  private val notificationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission(),
  ) { }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    enableEdgeToEdge()
    lifecycle.addObserver(model)
    NotificationHelper.ensureChannels(this)
    requestNotificationPermissionIfNeeded()
    applyDeepLink(intent)
    setContent {
      TetherTheme { TetherRoot(model) }
    }
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
    val parts = intent.data?.pathSegments ?: return
    if (parts.getOrNull(0) != "channels") return
    val first = parts.getOrNull(1) ?: return
    val second = parts.getOrNull(2)
    when {
      first == "@me" && !second.isNullOrBlank() -> model.openChat(second, null, "Чат", true)
      !second.isNullOrBlank() -> model.openChat(second, first, "Чат", false)
    }
  }

  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
    ) {
      return
    }
    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
  }

  companion object {
    const val EXTRA_CHANNEL_ID = "channelId"
    const val EXTRA_SERVER_ID = "serverId"
    const val EXTRA_CHAT_TITLE = "chatTitle"
  }
}
