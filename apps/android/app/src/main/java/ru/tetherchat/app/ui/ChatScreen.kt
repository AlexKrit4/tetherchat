package ru.tetherchat.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.PersonOff
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.automirrored.outlined.Reply
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import ru.tetherchat.app.data.Attachment
import ru.tetherchat.app.data.Message
import ru.tetherchat.app.data.PublicUser
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val QuickReactions = listOf("👍", "❤️", "😂", "🎉", "👀", "🔥")

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ChatScreen(model: AppViewModel, chat: Screen.Chat) {
  val listState = rememberLazyListState()
  val context = LocalContext.current
  var selected by remember { mutableStateOf<Message?>(null) }
  var showSettings by remember { mutableStateOf(false) }
  var preview by remember { mutableStateOf<Attachment?>(null) }
  val pickFiles = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
    if (uris.isNotEmpty()) model.attachUris(uris)
  }

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
        .padding(end = 4.dp, top = 4.dp, bottom = 4.dp),
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
        modifier = Modifier.weight(1f),
      )
      IconButton(onClick = { showSettings = true }) {
        Icon(Icons.Outlined.Settings, contentDescription = "Настройки чата", tint = TextMuted)
      }
    }
    LazyColumn(
      state = listState,
      modifier = Modifier.weight(1f).fillMaxWidth(),
      contentPadding = PaddingValues(vertical = 12.dp),
    ) {
      items(model.messages, key = { it.id }) { message ->
        MessageRow(
          message = message,
          model = model,
          onLongPress = { selected = message },
          onOpenAttachment = { attachment ->
            if (attachment.isImage) preview = attachment
            else {
              runCatching {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(attachment.url)))
              }
            }
          },
        )
      }
    }
    ComposerExtras(model)
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .background(SurfacePanel)
        .padding(8.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      IconButton(onClick = { pickFiles.launch(arrayOf("*/*")) }) {
        Icon(Icons.Outlined.Add, contentDescription = "Прикрепить файл", tint = TextMuted)
      }
      OutlinedTextField(
        value = model.draft,
        onValueChange = { model.draft = it },
        modifier = Modifier.weight(1f),
        placeholder = { Text(if (model.editing != null) "Изменить сообщение" else "Написать сообщение", color = TextMuted) },
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
      val canSend = model.draft.isNotBlank() || model.pendingUploads.any { it.attachment != null }
      IconButton(onClick = model::send, enabled = canSend && model.pendingUploads.none { it.attachment == null && it.error == null }) {
        Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = "Отправить", tint = Brand)
      }
    }
  }

  val selectedMessage = selected
  if (selectedMessage != null) {
    MessageActionSheet(
      message = selectedMessage,
      meId = model.me?.id,
      dm = chat.dm,
      onDismiss = { selected = null },
      onReply = { model.startReply(selectedMessage); selected = null },
      onCopy = {
        context.getSystemService(ClipboardManager::class.java)
          ?.setPrimaryClip(ClipData.newPlainText("message", selectedMessage.content))
        selected = null
      },
      onEdit = { model.startEdit(selectedMessage); selected = null },
      onPin = { model.togglePin(selectedMessage); selected = null },
      onDelete = { model.deleteMessage(selectedMessage); selected = null },
      onReact = { emoji -> model.react(selectedMessage, emoji); selected = null },
      onBlock = {
        model.blockUser(selectedMessage.authorId)
        selected = null
      },
    )
  }

  if (showSettings) {
    ChatSettingsSheet(model, chat, onDismiss = { showSettings = false })
  }

  val lightbox = preview
  if (lightbox != null) {
    Dialog(onDismissRequest = { preview = null }, properties = DialogProperties(usePlatformDefaultWidth = false)) {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(Color.Black)
          .clickable { preview = null },
        contentAlignment = Alignment.Center,
      ) {
        AsyncImage(
          model = lightbox.url,
          contentDescription = lightbox.filename,
          modifier = Modifier.fillMaxWidth().padding(12.dp),
          contentScale = ContentScale.Fit,
        )
      }
    }
  }
}

@Composable
private fun ComposerExtras(model: AppViewModel) {
  val extra = model.editing ?: model.replyTo
  if (extra != null) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .background(SurfacePanel)
        .padding(horizontal = 12.dp, vertical = 6.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(Modifier.weight(1f)) {
        Text(
          if (model.editing != null) "Редактирование" else "Ответ ${extra.author.label}",
          color = Brand,
          fontSize = 12.sp,
          fontWeight = FontWeight.SemiBold,
        )
        Text(extra.content.ifBlank { "Вложение" }, color = TextMuted, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
      }
      IconButton(onClick = model::cancelComposerExtra) {
        Icon(Icons.Outlined.Close, contentDescription = "Отмена", tint = TextMuted)
      }
    }
  }
  if (model.pendingUploads.isNotEmpty()) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .background(SurfacePanel)
        .horizontalScroll(rememberScrollState())
        .padding(horizontal = 12.dp, vertical = 6.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      model.pendingUploads.forEach { pending ->
        Row(
          modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(SurfaceDeep)
            .padding(horizontal = 10.dp, vertical = 6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(
            pending.error ?: pending.filename,
            color = if (pending.error != null) Danger else TextPrimary,
            fontSize = 12.sp,
            maxLines = 1,
          )
          IconButton(onClick = { model.removePending(pending.localId) }, modifier = Modifier.size(28.dp)) {
            Icon(Icons.Outlined.Close, contentDescription = "Убрать", tint = TextMuted, modifier = Modifier.size(16.dp))
          }
        }
      }
    }
  }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageRow(
  message: Message,
  model: AppViewModel,
  onLongPress: () -> Unit,
  onOpenAttachment: (Attachment) -> Unit,
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .combinedClickable(onClick = {}, onLongClick = onLongPress)
      .padding(horizontal = 12.dp, vertical = 6.dp),
    horizontalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    UserAvatar(message.author, 40.dp, model.statusOf(message.authorId, message.author.status))
    Column(Modifier.weight(1f)) {
      Row(verticalAlignment = Alignment.Bottom) {
        Text(message.author.label, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
        Spacer(Modifier.width(8.dp))
        Text(formatTime(message.createdAt), color = TextMuted, fontSize = 12.sp)
        if (message.editedAt != null) {
          Spacer(Modifier.width(6.dp))
          Text("изменено", color = TextMuted, fontSize = 11.sp)
        }
      }
      val reply = message.replyTo
      if (reply != null) {
        Text(
          "↪ ${reply.author?.label ?: "Сообщение"}: ${if (reply.deleted) "удалено" else reply.content}",
          color = TextMuted,
          fontSize = 12.sp,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.padding(top = 2.dp),
        )
      }
      if (message.content.isNotBlank()) {
        Text(message.content, color = TextPrimary, fontSize = 15.sp)
      }
      message.attachments.forEach { attachment ->
        if (attachment.isImage && attachment.url.isNotBlank()) {
          AsyncImage(
            model = attachment.url,
            contentDescription = attachment.filename,
            contentScale = ContentScale.Crop,
            modifier = Modifier
              .padding(top = 6.dp)
              .fillMaxWidth()
              .heightIn(min = 120.dp, max = 280.dp)
              .clip(RoundedCornerShape(8.dp))
              .clickable { onOpenAttachment(attachment) },
          )
        } else {
          Text(
            attachment.filename.ifBlank { "Вложение" },
            color = Brand,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 4.dp).clickable { onOpenAttachment(attachment) },
          )
        }
      }
      if (message.reactions.isNotEmpty()) {
        Row(
          modifier = Modifier.padding(top = 4.dp),
          horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          message.reactions.forEach { reaction ->
            Text(
              "${reaction.emoji} ${reaction.count}",
              color = if (reaction.me) Brand else TextMuted,
              fontSize = 12.sp,
              modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(if (reaction.me) Brand.copy(alpha = 0.18f) else SurfaceDeep)
                .clickable { model.react(message, reaction.emoji) }
                .padding(horizontal = 8.dp, vertical = 3.dp),
            )
          }
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MessageActionSheet(
  message: Message,
  meId: String?,
  dm: Boolean,
  onDismiss: () -> Unit,
  onReply: () -> Unit,
  onCopy: () -> Unit,
  onEdit: () -> Unit,
  onPin: () -> Unit,
  onDelete: () -> Unit,
  onReact: (String) -> Unit,
  onBlock: () -> Unit,
) {
  val own = message.authorId == meId
  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    containerColor = SurfacePanel,
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
      horizontalArrangement = Arrangement.SpaceEvenly,
    ) {
      QuickReactions.forEach { emoji ->
        Text(
          emoji,
          fontSize = 22.sp,
          modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(SurfaceDeep)
            .clickable { onReact(emoji) }
            .padding(horizontal = 10.dp, vertical = 8.dp),
        )
      }
    }
    HorizontalDivider(color = SurfaceDeep)
    SheetRow(Icons.AutoMirrored.Outlined.Reply, "Ответить", onReply)
    if (message.content.isNotBlank()) SheetRow(Icons.Outlined.ContentCopy, "Копировать текст", onCopy)
    if (own) SheetRow(Icons.Outlined.Edit, "Изменить сообщение", onEdit)
    if (!dm) SheetRow(Icons.Outlined.PushPin, if (message.pinned) "Открепить сообщение" else "Закрепить сообщение", onPin)
    if (own) SheetRow(Icons.Outlined.Delete, "Удалить сообщение", onDelete, danger = true)
    if (!own && dm) SheetRow(Icons.Outlined.PersonOff, "Заблокировать", onBlock, danger = true)
    Spacer(Modifier.height(16.dp))
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatSettingsSheet(model: AppViewModel, chat: Screen.Chat, onDismiss: () -> Unit) {
  val meId = model.me?.id.orEmpty()
  val conversation = model.currentConversation
  val people: List<PublicUser> = when {
    chat.dm && conversation != null -> conversation.members
    else -> model.members.map { it.user }
  }
  val peer = conversation?.peer(meId)
  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    containerColor = SurfacePanel,
  ) {
    Text(
      "Настройки чата",
      color = TextPrimary,
      fontWeight = FontWeight.SemiBold,
      fontSize = 16.sp,
      modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
    )
    Text("Участники", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp))
    people.take(12).forEach { user ->
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        UserAvatar(user, 32.dp, model.statusOf(user.id, user.status))
        Spacer(Modifier.width(10.dp))
        Text(user.label, color = TextPrimary, fontSize = 15.sp)
      }
    }
    if (!chat.dm) {
      TextButton(onClick = { model.toggleMute(); onDismiss() }, modifier = Modifier.padding(horizontal = 8.dp)) {
        Text(if (model.channelMuted) "Включить уведомления канала" else "Отключить уведомления канала", color = TextPrimary)
      }
    }
    if (chat.dm && conversation?.isGroup == true) {
      TextButton(onClick = { model.leaveGroup(); onDismiss() }, modifier = Modifier.padding(horizontal = 8.dp)) {
        Text("Покинуть группу", color = Danger)
      }
    }
    if (chat.dm && peer != null && conversation?.isGroup != true) {
      TextButton(onClick = { model.blockUser(peer.id); onDismiss() }, modifier = Modifier.padding(horizontal = 8.dp)) {
        Text("Заблокировать ${peer.label}", color = Danger)
      }
    }
    Spacer(Modifier.height(20.dp))
  }
}

@Composable
private fun SheetRow(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  label: String,
  onClick: () -> Unit,
  danger: Boolean = false,
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .clickable(onClick = onClick)
      .padding(horizontal = 20.dp, vertical = 14.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(icon, contentDescription = null, tint = if (danger) Danger else TextMuted, modifier = Modifier.size(20.dp))
    Spacer(Modifier.width(14.dp))
    Text(label, color = if (danger) Danger else TextPrimary, fontSize = 16.sp)
  }
}

private val timeFmt = DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault())

private fun formatTime(iso: String): String {
  return runCatching { timeFmt.format(Instant.parse(iso)) }.getOrElse { "" }
}
