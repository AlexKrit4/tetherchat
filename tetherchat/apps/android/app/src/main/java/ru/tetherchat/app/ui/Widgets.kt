package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ru.tetherchat.app.data.PublicUser

@Composable
fun UserAvatar(user: PublicUser, size: Dp, status: String? = null) {
  Box(modifier = Modifier.size(size)) {
    val color = user.bannerColor
      ?.takeIf { it.isNotBlank() }
      ?.let { runCatching { Color(android.graphics.Color.parseColor(it)) }.getOrNull() }
      ?: Brand
    if (!user.avatarUrl.isNullOrBlank()) {
      AsyncImage(
        model = user.avatarUrl,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier.fillMaxSize().clip(CircleShape),
      )
    } else {
      Box(
        modifier = Modifier.fillMaxSize().clip(CircleShape).background(color),
        contentAlignment = Alignment.Center,
      ) {
        Text(
          text = user.label.take(1).uppercase(),
          color = Color.White,
          fontWeight = FontWeight.SemiBold,
          fontSize = (size.value * 0.4f).sp,
        )
      }
    }
    if (status != null) {
      Box(
        modifier = Modifier
          .align(Alignment.BottomEnd)
          .size(size * 0.34f)
          .clip(CircleShape)
          .background(SurfaceDeep),
        contentAlignment = Alignment.Center,
      ) {
        Box(
          modifier = Modifier
            .size(size * 0.22f)
            .clip(CircleShape)
            .background(statusColor(status)),
        )
      }
    }
  }
}

@Composable
fun BootSplash() {
  Box(
    modifier = Modifier.fillMaxSize().background(SurfaceDeep),
    contentAlignment = Alignment.Center,
  ) {
    CircularProgressIndicator(color = Brand)
  }
}
