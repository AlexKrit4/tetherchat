package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

fun markdownAnnotated(text: String): AnnotatedString = buildAnnotatedString {
  append(text)
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
  """https?://\S+""".toRegex().findAll(text).forEach { m ->
    addStyle(SpanStyle(color = Brand, textDecoration = TextDecoration.Underline), m.range.first, m.range.last + 1)
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
    Text(markdownAnnotated(text), color = color, fontSize = 15.sp)
    return
  }
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
    Column {
      parts.forEach { part ->
        if (part.spoiler) {
          SpoilerChip(part.text)
        } else if (part.text.isNotEmpty()) {
          Text(markdownAnnotated(part.text), color = color, fontSize = 15.sp)
        }
      }
    }
  }
}

@Composable
private fun SpoilerChip(text: String) {
  var revealed by remember(text) { mutableStateOf(false) }
  Text(
    if (revealed) markdownAnnotated(text) else AnnotatedString("Спойлер"),
    color = if (revealed) TextPrimary else Color.White,
    fontSize = 15.sp,
    modifier = Modifier
      .padding(top = 2.dp, bottom = 2.dp)
      .clip(RoundedCornerShape(6.dp))
      .background(if (revealed) SurfaceDeep else Color(0xFF111214))
      .clickable { revealed = true }
      .padding(horizontal = 8.dp, vertical = 2.dp),
  )
}

