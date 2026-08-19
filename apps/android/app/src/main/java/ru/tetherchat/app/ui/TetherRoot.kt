package ru.tetherchat.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import ru.tetherchat.app.BuildConfig

@Composable
fun TetherRoot(model: AppViewModel) {
  val snack = remember { SnackbarHostState() }
  LaunchedEffect(model.error) {
    val text = model.error ?: return@LaunchedEffect
    val screen = model.screen
    val toastable = screen is Screen.Home || screen is Screen.Chat || screen is Screen.Settings ||
      screen is Screen.Blacklist || screen is Screen.ServerSettings || screen is Screen.Members ||
      screen is Screen.ProfileSettings || screen is Screen.AccountSettings ||
      screen is Screen.Sessions ||
      screen is Screen.AppearanceSettings || screen is Screen.UserProfile
    if (toastable) {
      snack.showSnackbar(text)
      model.error = null
    }
  }
  val canGoBack = when (model.screen) {
    Screen.Boot, Screen.Login, Screen.Home -> false
    else -> true
  }
  BackHandler(enabled = canGoBack) { model.back() }
  Box(Modifier.fillMaxSize().background(SurfaceDeep)) {
    when (val screen = model.screen) {
      Screen.Boot -> BootSplash()
      Screen.Login -> LoginScreen(model)
      Screen.Register -> RegisterScreen(model)
      Screen.ForgotPassword -> ForgotPasswordScreen(model)
      is Screen.ResetPassword -> ResetPasswordScreen(model, screen.token)
      is Screen.VerifyEmail -> VerifyEmailScreen(model, screen.token)
      is Screen.Invite -> InviteLandingScreen(model)
      Screen.Home -> HomeScreen(model)
      Screen.Settings -> SettingsScreen(model)
      Screen.ProfileSettings -> ProfileSettingsScreen(model)
      Screen.AccountSettings -> AccountSettingsScreen(model)
      Screen.Sessions -> SessionsScreen(model)
      Screen.AppearanceSettings -> AppearanceSettingsScreen(model)
      Screen.Blacklist -> BlacklistScreen(model)
      Screen.ServerSettings -> ServerSettingsScreen(model)
      Screen.Members -> MembersScreen(model)
      is Screen.UserProfile -> UserProfileScreen(model)
      is Screen.Chat -> ChatScreen(model, screen)
    }
    SnackbarHost(snack, modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp))
    UpdateDialog(model)
  }
}

@Composable
private fun UpdateDialog(model: AppViewModel) {
  val update = model.availableUpdate ?: return
  val downloading = model.updateDownloading
  val failed = model.updateFailed
  val needsPermission = model.needsInstallPermission
  val ready = model.pendingInstall && !downloading
  AlertDialog(
    onDismissRequest = { if (!downloading) model.dismissUpdate() },
    properties = DialogProperties(
      dismissOnBackPress = !downloading,
      dismissOnClickOutside = !downloading,
    ),
    title = {
      Text(
        when {
          downloading -> "Скачивание обновления"
          needsPermission -> "Разрешите установку"
          failed != null -> "Не удалось обновить"
          ready -> "Установка"
          else -> "Доступно обновление"
        },
      )
    },
    text = {
      Column(Modifier.fillMaxWidth()) {
        when {
          downloading -> {
            Text("Загружается TetherChat ${update.versionName}…")
            Spacer(Modifier.height(12.dp))
            if (model.updateBytesTotal > 0) {
              LinearProgressIndicator(
                progress = { model.updateProgress },
                modifier = Modifier.fillMaxWidth(),
                color = Brand,
                trackColor = SurfaceRaised,
              )
              Spacer(Modifier.height(8.dp))
              Text(
                "${(model.updateProgress * 100).toInt()}%  ·  ${formatMb(model.updateBytesRead)} / ${formatMb(model.updateBytesTotal)}",
                color = TextMuted,
              )
            } else {
              LinearProgressIndicator(
                modifier = Modifier.fillMaxWidth(),
                color = Brand,
                trackColor = SurfaceRaised,
              )
            }
          }
          needsPermission -> {
            Text("Android просит разрешение устанавливать приложения из TetherChat. Включите его и вернитесь сюда — установка продолжится сама.")
          }
          failed != null -> {
            Text(failed)
          }
          ready -> {
            Text("Файл скачан. Если окно установки не открылось, нажмите «Установить».")
            Spacer(Modifier.height(12.dp))
            LinearProgressIndicator(
              progress = { 1f },
              modifier = Modifier.fillMaxWidth(),
              color = Brand,
              trackColor = SurfaceRaised,
            )
          }
          else -> {
            Text("TetherChat ${update.versionName} уже вышла. Сейчас установлена ${BuildConfig.VERSION_NAME}. Скачайте и сразу установите новую версию.")
          }
        }
      }
    },
    confirmButton = {
      when {
        downloading -> { }
        needsPermission -> TextButton(onClick = model::openInstallPermissionSettings) {
          Text("Разрешить", color = Brand)
        }
        failed != null -> TextButton(onClick = model::startUpdateDownload) {
          Text("Повторить", color = Brand)
        }
        ready -> TextButton(onClick = model::installDownloadedUpdate) {
          Text("Установить", color = Brand)
        }
        else -> TextButton(onClick = model::startUpdateDownload) {
          Text("Скачать", color = Brand)
        }
      }
    },
    dismissButton = {
      TextButton(onClick = model::dismissUpdate) {
        Text(if (downloading) "Отмена" else "Позже", color = TextMuted)
      }
    },
  )
}

private fun formatMb(bytes: Long): String {
  if (bytes <= 0L) return "0 МБ"
  return String.format("%.1f МБ", bytes / (1024.0 * 1024.0))
}
