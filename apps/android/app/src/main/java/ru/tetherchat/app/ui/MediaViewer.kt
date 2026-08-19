package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage

data class ViewerMedia(
  val id: String,
  val url: String,
  val filename: String,
  val contentType: String,
  val spoiler: Boolean = false,
) {
  val isImage: Boolean get() = contentType.startsWith("image/")
  val isVideo: Boolean get() = contentType.startsWith("video/")
}

@Composable
fun MediaViewer(
  items: List<ViewerMedia>,
  currentId: String,
  onClose: () -> Unit,
) {
  if (items.isEmpty()) return
  val start = items.indexOfFirst { it.id == currentId }.coerceAtLeast(0)
  val pager = rememberPagerState(initialPage = start, pageCount = { items.size })
  var revealed by remember { mutableStateOf(setOf<String>()) }
  var scale by remember { mutableFloatStateOf(1f) }
  var offset by remember { mutableStateOf(Offset.Zero) }

  LaunchedEffect(pager.currentPage) {
    scale = 1f
    offset = Offset.Zero
  }

  Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
    Box(Modifier.fillMaxSize().background(Color.Black)) {
      HorizontalPager(
        state = pager,
        modifier = Modifier.fillMaxSize(),
        userScrollEnabled = scale <= 1.01f,
      ) { page ->
        val item = items[page]
        val hidden = item.spoiler && item.id !in revealed
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
          if (item.isImage) {
            ZoomableImage(
              url = item.url,
              filename = item.filename,
              spoiler = hidden,
              scale = scale,
              offset = offset,
              onScale = { scale = it },
              onOffset = { offset = it },
              onReveal = { revealed = revealed + item.id },
            )
          } else {
            Text(item.filename, color = Color.White, modifier = Modifier.padding(24.dp))
          }
        }
      }
      IconButton(
        onClick = onClose,
        modifier = Modifier
          .align(Alignment.TopEnd)
          .statusBarsPadding()
          .padding(8.dp),
      ) {
        Icon(Icons.Outlined.Close, contentDescription = "Закрыть", tint = Color.White)
      }
      if (items.size > 1) {
        Text(
          "${pager.currentPage + 1} / ${items.size}",
          color = Color.White,
          fontSize = 13.sp,
          modifier = Modifier
            .align(Alignment.BottomCenter)
            .padding(bottom = 24.dp),
        )
      }
    }
  }
}

@Composable
private fun ZoomableImage(
  url: String,
  filename: String,
  spoiler: Boolean,
  scale: Float,
  offset: Offset,
  onScale: (Float) -> Unit,
  onOffset: (Offset) -> Unit,
  onReveal: () -> Unit,
) {
  Box(
    modifier = Modifier
      .fillMaxSize()
      .pointerInput(url, spoiler) {
        detectTapGestures(
          onTap = { if (spoiler) onReveal() },
          onDoubleTap = {
            if (scale > 1.2f) {
              onScale(1f)
              onOffset(Offset.Zero)
            } else {
              onScale(2.5f)
            }
          },
        )
      }
      .pointerInput(url) {
        detectTransformGestures { _, pan, zoom, _ ->
          val next = (scale * zoom).coerceIn(1f, 5f)
          onScale(next)
          onOffset(if (next > 1f) offset + pan else Offset.Zero)
        }
      },
    contentAlignment = Alignment.Center,
  ) {
    AsyncImage(
      model = url,
      contentDescription = filename,
      contentScale = ContentScale.Fit,
      modifier = Modifier
        .fillMaxWidth()
        .padding(8.dp)
        .graphicsLayer {
          scaleX = scale
          scaleY = scale
          translationX = offset.x
          translationY = offset.y
        }
        .then(if (spoiler) Modifier.blur(28.dp) else Modifier),
    )
    if (spoiler) {
      Text(
        "Спойлер — нажмите, чтобы открыть",
        color = Color.White,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
      )
    }
  }
}

@Composable
fun SpoilerImage(
  url: String,
  filename: String,
  spoiler: Boolean,
  modifier: Modifier = Modifier,
  onOpen: () -> Unit,
) {
  var revealed by remember(url) { mutableStateOf(false) }
  val hidden = spoiler && !revealed
  Box(
    modifier = modifier.clickable {
      if (hidden) revealed = true else onOpen()
    },
    contentAlignment = Alignment.Center,
  ) {
    AsyncImage(
      model = url,
      contentDescription = filename,
      contentScale = ContentScale.Crop,
      modifier = Modifier
        .fillMaxSize()
        .then(if (hidden) Modifier.blur(22.dp) else Modifier),
    )
    if (hidden) {
      Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Спойлер", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
        Text("Нажмите, чтобы открыть", color = Color.White.copy(alpha = 0.8f), fontSize = 12.sp)
      }
    }
  }
}
