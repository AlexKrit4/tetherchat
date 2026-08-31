package ru.tetherchat.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Brand = Color(0xFF5865F2)
val AiAccent = Color(0xFF9B6BFF)
val SurfaceDeep = Color(0xFF1E1F22)
val SurfacePanel = Color(0xFF2B2D31)
val SurfaceRaised = Color(0xFF313338)
val TextPrimary = Color(0xFFF2F3F5)
val TextMuted = Color(0xFF949BA4)
val Online = Color(0xFF23A55A)
val Idle = Color(0xFFF0B232)
val Dnd = Color(0xFFF23F43)
val Offline = Color(0xFF80848E)
val Danger = Color(0xFFDA373C)

private val Colors = darkColorScheme(
  primary = Brand,
  onPrimary = Color.White,
  background = SurfaceDeep,
  surface = SurfacePanel,
  onBackground = TextPrimary,
  onSurface = TextPrimary,
  onSurfaceVariant = TextMuted,
  error = Danger,
)

@Composable
fun TetherTheme(content: @Composable () -> Unit) {
  MaterialTheme(colorScheme = Colors, content = content)
}

fun statusColor(status: String): Color = when (status) {
  "online" -> Online
  "idle" -> Idle
  "dnd" -> Dnd
  else -> Offline
}
