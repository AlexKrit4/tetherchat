package ru.tetherchat.app.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
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
