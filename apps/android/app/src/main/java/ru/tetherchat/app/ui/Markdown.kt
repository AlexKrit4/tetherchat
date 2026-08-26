package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.ClickableText
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val urlRegex = Regex("""https?://[^\s<]+""", RegexOption.IGNORE_CASE)

private fun trimUrlTail(raw: String): String = raw.trimEnd { it == '.' || it == ',' || it == ')' || it == '!' || it == '?' }

fun markdownAnnotated(text: String): AnnotatedString = buildAnnotatedString {
  var cursor = 0
  for (match in urlRegex.findAll(text)) {
    if (match.range.first > cursor) {
      append(text.substring(cursor, match.range.first))
    }
    val url = trimUrlTail(match.value)
    pushStringAnnotation("URL", url)
    pushStyle(SpanStyle(color = Brand, textDecoration = TextDecoration.Underline))
    append(url)
    pop()
    pop()
    cursor = match.range.first + match.value.length
  }
  if (cursor < text.length) append(text.substring(cursor))

  """\*\*(.+?)\*\*""".toRegex().findAll(text).forEach { m ->
    addStyle(SpanStyle(fontWeight = FontWeight.Bold), m.range.first, m.range.last + 1)
  }
  """(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)""".toRegex().findAll(text).forEach { m ->
    addStyle(SpanStyle(fontStyle = FontStyle.Italic), m.range.first, m.range.last + 1)
  }
  """`([^`]+)`""".toRegex().findAll(text).forEach { m ->
    addStyle(SpanStyle(fontFamily = FontFamily.Monospace, background = Color(0x22FFFFFF), fontSize = 13.sp), m.range.first, m.range.last + 1)
  }
  """~~(.+?)~~""".toRegex().findAll(text).forEach { m ->
    addStyle(SpanStyle(textDecoration = TextDecoration.LineThrough), m.range.first, m.range.last + 1)
  }
  """<@(\d+)>""".toRegex().findAll(text).forEach { m ->
    addStyle(SpanStyle(color = Brand, background = Color(0x334A90E2)), m.range.first, m.range.last + 1)
  }
  """<#(\d+)>""".toRegex().findAll(text).forEach { m ->
    addStyle(SpanStyle(color = Brand), m.range.first, m.range.last + 1)
  }
  """@everyone""".toRegex().findAll(text).forEach { m ->
    addStyle(SpanStyle(color = Brand, background = Color(0x33F0B232)), m.range.first, m.range.last + 1)
  }
}

@Composable
private fun ClickableMessageText(text: String, color: Color) {
  val uriHandler = LocalUriHandler.current
  val annotated = remember(text) { markdownAnnotated(text) }
  ClickableText(
    text = annotated,
    style = androidx.compose.ui.text.TextStyle(color = color, fontSize = 15.sp),
    onClick = { offset ->
      annotated.getStringAnnotations("URL", offset, offset).firstOrNull()?.let { uriHandler.openUri(it.item) }
    },
  )
}

private data class SpoilerPart(val text: String, val spoiler: Boolean)

private fun splitSpoilers(text: String): List<SpoilerPart> {
  val regex = Regex("""\|\|([\s\S]+?)\|\|""")
  val parts = mutableListOf<SpoilerPart>()
  var last = 0
  regex.findAll(text).forEach { match ->
    if (match.range.first > last) {
      parts += SpoilerPart(text.substring(last, match.range.first), false)
    }
    parts += SpoilerPart(match.groupValues[1], true)
    last = match.range.last + 1
  }
  if (last < text.length) parts += SpoilerPart(text.substring(last), false)
  if (parts.isEmpty()) parts += SpoilerPart(text, false)
  return parts
}

@Composable
fun MessageBody(text: String, color: Color = TextPrimary) {
  val parts = remember(text) { splitSpoilers(text) }
  if (parts.none { it.spoiler }) {
    ClickableMessageText(text, color)
    return
  }
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
    Column {
      parts.forEach { part ->
        if (part.spoiler) {
          SpoilerChip(part.text, color)
        } else if (part.text.isNotEmpty()) {
          ClickableMessageText(part.text, color)
        }
      }
    }
  }
}

@Composable
private fun SpoilerChip(text: String, color: Color) {
  var revealed by remember(text) { mutableStateOf(false) }
  if (revealed) {
    ClickableMessageText(text, color)
  } else {
    Text(
      "Спойлер",
      color = Color.White,
      fontSize = 15.sp,
      modifier = Modifier
        .padding(top = 2.dp, bottom = 2.dp)
        .clip(androidx.compose.foundation.shape.RoundedCornerShape(6.dp))
        .background(Color(0xFF111214))
        .clickable { revealed = true }
        .padding(horizontal = 8.dp, vertical = 2.dp),
    )
  }
}
