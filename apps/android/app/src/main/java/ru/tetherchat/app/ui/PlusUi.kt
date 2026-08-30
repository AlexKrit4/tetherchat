package ru.tetherchat.app.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.tetherchat.app.data.PublicUser
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val lastSeenTimeFmt = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault())
private val lastSeenDateFmt = DateTimeFormatter.ofPattern("d MMMM", Locale("ru"))

fun plusAccentColor(user: PublicUser?): Color {
  if (user?.isPlus != true) return TextPrimary
  val hex = user.accentColor ?: user.bannerColor ?: return TextPrimary
  return runCatching {
    Color(android.graphics.Color.parseColor(if (hex.startsWith("#")) hex else "#$hex"))
  }.getOrDefault(TextPrimary)
}

fun formatLastSeen(iso: String): String {
  val instant = runCatching { Instant.parse(iso) }.getOrNull() ?: return "не в сети"
  val zoned = instant.atZone(ZoneId.systemDefault())
  val minutes = Duration.between(instant, Instant.now()).toMinutes()
  val date = zoned.toLocalDate()
  val today = LocalDate.now(ZoneId.systemDefault())
  val time = lastSeenTimeFmt.format(instant)
  return when {
    minutes < 1 -> "был(а) только что"
    minutes < 60 -> "был(а) $minutes мин назад"
    date.isEqual(today) -> "был(а) сегодня в $time"
    date.isEqual(today.minusDays(1)) -> "был(а) вчера в $time"
    else -> "был(а) ${lastSeenDateFmt.format(date)} в $time"
  }
}

fun lastSeenSubtitle(user: PublicUser, liveStatus: String?): String {
  val status = liveStatus ?: user.status
  return when (status) {
    "online" -> "онлайн"
    "idle" -> "отошёл"
    "dnd" -> "не беспокоить"
    else -> user.lastSeenAt?.let(::formatLastSeen) ?: "не в сети"
  }
}

@Composable
fun PlusName(
  user: PublicUser,
  modifier: Modifier = Modifier,
  name: String = user.label,
  fontSize: TextUnit = 16.sp,
  fontWeight: FontWeight = FontWeight.Medium,
  maxLines: Int = 1,
  color: Color = plusAccentColor(user),
) {
  Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
    Text(
      name,
      color = color,
      fontSize = fontSize,
      fontWeight = fontWeight,
      maxLines = maxLines,
      overflow = TextOverflow.Ellipsis,
      modifier = Modifier.weight(1f, fill = false),
    )
    if (user.isPlus) {
      Text("★", color = Brand, fontSize = (fontSize.value * 0.75f).sp, modifier = Modifier.padding(start = 4.dp))
    }
  }
}

@Composable
fun BioText(text: String, plus: Boolean, modifier: Modifier = Modifier) {
  if (!plus) {
    Text(text, color = TextPrimary, modifier = modifier)
    return
  }
  val uriHandler = LocalUriHandler.current
  val annotated = remember(text) {
    val regex = Regex("https?://[^\\s<]+", RegexOption.IGNORE_CASE)
    buildAnnotatedString {
      var cursor = 0
      for (match in regex.findAll(text)) {
        if (match.range.first > cursor) append(text.substring(cursor, match.range.first))
        val url = match.value.trimEnd { it == '.' || it == ',' || it == ')' }
        pushStringAnnotation("URL", url)
        pushStyle(SpanStyle(color = Brand, textDecoration = TextDecoration.Underline))
        append(url)
        pop()
        pop()
        cursor = match.range.first + match.value.length
      }
      if (cursor < text.length) append(text.substring(cursor))
    }
  }
  ClickableText(
    text = annotated,
    modifier = modifier,
    style = androidx.compose.ui.text.TextStyle(color = TextPrimary, fontSize = 16.sp),
    onClick = { offset ->
      annotated.getStringAnnotations("URL", offset, offset).firstOrNull()?.let { uriHandler.openUri(it.item) }
    },
  )
}
