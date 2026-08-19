package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.tetherchat.app.data.Message
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Composable
fun ChatScreen(model: AppViewModel, chat: Screen.Chat) {
  val listState = rememberLazyListState()
  LaunchedEffect(model.messages.lastOrNull()?.id) {
    if (model.messages.isNotEmpty()) listState.animateScrollToItem(model.messages.lastIndex)
  }
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceRaised)
      .statusBarsPadding()
      .imePadding()
      .navigationBarsPadding(),
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .background(SurfacePanel)
        .padding(end = 12.dp, top = 4.dp, bottom = 4.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      IconButton(onClick = model::back) {
        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад", tint = TextPrimary)
      }
      Text(
        chat.title,
        color = TextPrimary,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    }
    LazyColumn(
      state = listState,
      modifier = Modifier.weight(1f).fillMaxWidth(),
      contentPadding = PaddingValues(vertical = 12.dp),
    ) {
      items(model.messages, key = { it.id }) { message ->
        MessageRow(message, model)
      }
    }
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .background(SurfacePanel)
        .padding(8.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      OutlinedTextField(
        value = model.draft,
        onValueChange = { model.draft = it },
        modifier = Modifier.weight(1f),
        placeholder = { Text("Написать сообщение", color = TextMuted) },
        maxLines = 4,
        shape = RoundedCornerShape(20.dp),
        colors = OutlinedTextFieldDefaults.colors(
          focusedTextColor = TextPrimary,
          unfocusedTextColor = TextPrimary,
          focusedContainerColor = SurfaceDeep,
          unfocusedContainerColor = SurfaceDeep,
          focusedBorderColor = SurfaceDeep,
          unfocusedBorderColor = SurfaceDeep,
          cursorColor = Brand,
        ),
      )
      IconButton(onClick = model::send, enabled = model.draft.isNotBlank()) {
        Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = "Отправить", tint = Brand)
      }
    }
  }
}

@Composable
private fun MessageRow(message: Message, model: AppViewModel) {
  Row(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp),
    horizontalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    UserAvatar(message.author, 40.dp, model.statusOf(message.authorId, message.author.status))
    Column(Modifier.weight(1f)) {
      Row(verticalAlignment = Alignment.Bottom) {
        Text(message.author.label, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Spacer(Modifier.width(8.dp))
        Text(formatTime(message.createdAt), color = TextMuted, fontSize = 12.sp)
      }
      if (message.content.isNotBlank()) {
        Text(message.content, color = TextPrimary, fontSize = 15.sp)
      }
      message.attachments.forEach { attachment ->
        Text(attachment.filename.ifBlank { "Вложение" }, color = Brand, fontSize = 13.sp)
      }
    }
  }
}

private val timeFmt = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault())

private fun formatTime(iso: String): String {
  return runCatching { timeFmt.format(Instant.parse(iso)) }.getOrElse { "" }
}
