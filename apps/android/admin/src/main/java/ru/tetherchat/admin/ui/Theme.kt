package ru.tetherchat.admin.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Brand = Color(0xFF5865F2)
val SurfaceDeep = Color(0xFF1E1F22)
val SurfacePanel = Color(0xFF2B2D31)
val TextPrimary = Color(0xFFF2F3F5)
val TextMuted = Color(0xFF949BA4)
val Danger = Color(0xFFDA373C)
val Online = Color(0xFF23A55A)

@Composable
fun AdminTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = darkColorScheme(
      primary = Brand,
      onPrimary = Color.White,
      background = SurfaceDeep,
      surface = SurfacePanel,
      onBackground = TextPrimary,
      onSurface = TextPrimary,
      error = Danger,
    ),
    content = content,
  )
}
