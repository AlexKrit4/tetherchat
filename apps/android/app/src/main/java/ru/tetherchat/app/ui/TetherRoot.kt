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
    if (model.screen is Screen.Home || model.screen is Screen.Chat) {
      snack.showSnackbar(text)
      model.error = null
    }
  }
  BackHandler(enabled = model.screen is Screen.Chat || model.screen is Screen.Register) {
    model.back()
  }
  Box(Modifier.fillMaxSize().background(SurfaceDeep)) {
    when (val screen = model.screen) {
      Screen.Boot -> BootSplash()
      Screen.Login -> LoginScreen(model)
      Screen.Register -> RegisterScreen(model)
      Screen.Home -> HomeScreen(model)
      is Screen.Chat -> ChatScreen(model, screen)
    }
    SnackbarHost(snack, modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp))
  }
}
