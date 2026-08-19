package ru.tetherchat.app.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun TetherRoot(model: AppViewModel) {
  val snack = remember { SnackbarHostState() }
  LaunchedEffect(model.error) {
    val text = model.error ?: return@LaunchedEffect
    val screen = model.screen
    val toastable = screen is Screen.Home || screen is Screen.Chat || screen is Screen.Settings ||
      screen is Screen.Blacklist || screen is Screen.ServerSettings || screen is Screen.Members ||
      screen is Screen.ProfileSettings || screen is Screen.AccountSettings ||
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
      Screen.AppearanceSettings -> AppearanceSettingsScreen(model)
      Screen.Blacklist -> BlacklistScreen(model)
      Screen.ServerSettings -> ServerSettingsScreen(model)
      Screen.Members -> MembersScreen(model)
      is Screen.UserProfile -> UserProfileScreen(model)
      is Screen.Chat -> ChatScreen(model, screen)
    }
    SnackbarHost(snack, modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp))
  }
}
