package ru.tetherchat.app.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.core.content.ContextCompat
import android.media.MediaPlayer
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.DoneAll
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.automirrored.outlined.Forward
import androidx.compose.runtime.DisposableEffect
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.graphics.Bitmap
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import com.canhub.cropper.CropImageContract
import com.canhub.cropper.CropImageContractOptions
import com.canhub.cropper.CropImageOptions
import com.canhub.cropper.CropImageView
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Reply
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Collections
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.EmojiEmotions
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.zIndex
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import ru.tetherchat.app.data.Attachment
import ru.tetherchat.app.data.LinkPreview
import ru.tetherchat.app.data.Message
import ru.tetherchat.app.data.Perm
import ru.tetherchat.app.data.PublicUser
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private const val MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000L

private val QuickReactions = listOf("👍", "❤️", "😂", "🎉", "👀", "🔥")
private val EmojiGrid = listOf(
  "😀", "😂", "😍", "🥰", "😎", "🤔", "😢", "😭", "😤", "🤗",
  "👍", "👎", "❤️", "🔥", "🎉", "👀", "💯", "✨", "⭐", "🙏",
  "👋", "✅", "❌", "💜", "💙", "💚", "🧡", "🤣", "💀", "🫡",
  "🤝", "💪", "⚡", "🌟", "📌", "📷", "🎵", "🎮", "🧠", "😴",
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ChatScreen(model: AppViewModel, chat: Screen.Chat) {
  val listState = remember(chat.channelId) { LazyListState() }
  val context = LocalContext.current
  val density = LocalDensity.current
  val imeBottom = WindowInsets.ime.getBottom(density)
  var pinnedToLatest by remember(chat.channelId) { mutableStateOf(true) }
  var selected by remember { mutableStateOf<Message?>(null) }
  var showSettings by remember { mutableStateOf(false) }
  var preview by remember { mutableStateOf<Attachment?>(null) }
  var reportTarget by remember { mutableStateOf<Message?>(null) }
  val cropImage = rememberLauncherForActivityResult(CropImageContract()) { result ->
    if (result.isSuccessful) {
      result.uriContent?.let { model.attachUris(listOf(it)) }
    } else if (result.error != null) {
      model.error = result.error?.localizedMessage ?: "Не удалось обрезать фото"
    }
  }
  val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
    if (uri != null) {
      cropImage.launch(
        CropImageContractOptions(
          uri = uri,
          cropImageOptions = CropImageOptions(
            imageSourceIncludeCamera = false,
            imageSourceIncludeGallery = false,
            guidelines = CropImageView.Guidelines.ON,
            outputCompressFormat = Bitmap.CompressFormat.JPEG,
            activityTitle = "Обрезать фото",
            cropMenuCropButtonTitle = "Готово",
            allowRotation = true,
            allowFlipping = true,
          ),
        ),
      )
    }
  }
  val recordPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
    if (!granted) model.error = "Нужен доступ к микрофону"
  }
  val canSend = chat.dm || model.canPerm(Perm.SEND_MESSAGES) || model.isOwner()
  val canAttach =
    model.currentConversation?.isSecret != true &&
      (chat.dm || model.canPerm(Perm.ATTACH_FILES) || model.isOwner())
  val canManage = !chat.dm && (model.canPerm(Perm.MANAGE_MESSAGES) || model.isOwner())
  val topic = model.serverDetail?.channels?.firstOrNull { it.id == chat.channelId }?.topic
  val canCall = chat.dm &&
    model.currentConversation?.isSaved != true &&
    model.currentConversation?.isAi != true &&
    model.currentConversation?.isGroup != true &&
    model.callPhase == ru.tetherchat.app.data.CallPhase.Idle

  LaunchedEffect(listState, chat.channelId) {
    snapshotFlow {
      val info = listState.layoutInfo
      val lastVisible = info.visibleItemsInfo.maxOfOrNull { it.index } ?: 0
      val total = info.totalItemsCount
      total > 0 && lastVisible >= total - 2
    }.collect { nearOldest ->
      if (nearOldest && model.messagesHasMore && !model.busy) model.loadOlder()
    }
  }

  LaunchedEffect(listState, chat.channelId) {
    snapshotFlow {
      listState.firstVisibleItemIndex == 0 && listState.firstVisibleItemScrollOffset < 160
    }.collect { pinnedToLatest = it }
  }

  val newest = model.messages.lastOrNull()
  LaunchedEffect(newest?.id, imeBottom, chat.channelId) {
    if (newest == null) return@LaunchedEffect
    val mine = newest.authorId == model.me?.id
    if (mine || pinnedToLatest) {
      pinnedToLatest = true
      listState.scrollToItem(0)
    }
  }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceRaised)
      .safeDrawingPadding(),
  ) {
    if (!model.connected) {
      Text(
        "Нет соединения",
        color = Color.White,
        fontSize = 13.sp,
        modifier = Modifier.fillMaxWidth().background(Danger).padding(8.dp),
      )
    }
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
      if (model.currentConversation?.isSecret == true) {
        Icon(Icons.Outlined.Lock, contentDescription = "Секретный чат", tint = Online, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
      }
      Column(Modifier.weight(1f)) {
        Text(
          chat.title,
          color = TextPrimary,
          fontWeight = FontWeight.SemiBold,
          fontSize = 16.sp,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
        if (!topic.isNullOrBlank()) {
          Text(topic, color = TextMuted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
      }
      if (model.currentConversation?.isSecret != true) {
        IconButton(onClick = { model.showSearch = true }) {
          Icon(Icons.Outlined.Search, contentDescription = "Поиск", tint = TextMuted)
        }
      }
      if (canCall) {
        IconButton(onClick = { model.startOutgoingCall(chat.channelId) }) {
          Icon(Icons.Outlined.Phone, contentDescription = "Позвонить", tint = TextMuted)
        }
      }
      if (model.currentConversation?.isSecret != true) {
        IconButton(onClick = { model.loadChatMedia(); model.showMedia = true }) {
          Icon(Icons.Outlined.Collections, contentDescription = "Медиа", tint = TextMuted)
        }
      }
      if (!chat.dm) {
        IconButton(onClick = { model.loadPins(); model.showPins = true }) {
          Icon(Icons.Outlined.PushPin, contentDescription = "Закреплённые", tint = TextMuted)
        }
        IconButton(onClick = model::openMembers) {
          Icon(Icons.Outlined.People, contentDescription = "Участники", tint = TextMuted)
        }
      }
      IconButton(onClick = { showSettings = true }) {
        Icon(Icons.Outlined.Settings, contentDescription = "Настройки чата", tint = TextMuted)
      }
    }
    val reversedMessages = remember(model.messages) { model.messages.asReversed() }
    LazyColumn(
      state = listState,
      modifier = Modifier.weight(1f).fillMaxWidth(),
      reverseLayout = true,
      contentPadding = PaddingValues(vertical = 12.dp),
    ) {
      itemsIndexed(reversedMessages, key = { _, message -> message.id }) { index, message ->
        val showDayDivider = index >= reversedMessages.lastIndex ||
          dayKey(message.createdAt) != dayKey(reversedMessages[index + 1].createdAt)
        MessageRow(
          message = message,
          isGroupStart = isMessageGroupStart(reversedMessages, index),
          model = model,
          onLongPress = { selected = message },
          onOpenProfile = { model.openProfile(message.authorId) },
          onOpenAttachment = { attachment ->
            if (attachment.isImage) preview = attachment
            else {
              runCatching {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(attachment.url)))
              }
            }
          },
        )
        // reverseLayout inverts sibling order within an item — render the divider after
        // the row so it appears above the message in the chat.
        if (showDayDivider) {
          DayDivider(label = formatDayLabel(message.createdAt))
        }
      }
    }
    model.typingLabel?.let { label ->
      Text(label, color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
    }
    MentionSuggestions(model, chat)
    ComposerExtras(model)
    if (model.showEmojiPicker) {
      EmojiPickerSheet(onPick = { emoji ->
        model.updateDraft(model.draft + emoji)
        model.showEmojiPicker = false
      })
    }
    if (canSend) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .zIndex(1f)
          .background(SurfacePanel),
      ) {
        if (model.recording) {
          Text(
            formatVoiceClock(model.recordElapsedMs),
            color = Danger,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            modifier = Modifier
              .fillMaxWidth()
              .padding(top = 8.dp, bottom = 2.dp),
          )
        }
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        if (canAttach) {
          IconButton(onClick = {
            pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
          }) {
            Icon(Icons.Outlined.Add, contentDescription = "Прикрепить фото", tint = TextMuted)
          }
        }
        IconButton(onClick = { model.showEmojiPicker = !model.showEmojiPicker }) {
          Icon(Icons.Outlined.EmojiEmotions, contentDescription = "Эмодзи", tint = TextMuted)
        }
        val voiceDraft = model.voiceDraft
        if (voiceDraft != null) {
          VoiceDraftPreview(
            draft = voiceDraft,
            modifier = Modifier.weight(1f),
            onDiscard = model::discardVoiceDraft,
          )
        } else {
          OutlinedTextField(
            value = model.draft,
            onValueChange = model::updateDraft,
            modifier = Modifier.weight(1f),
            placeholder = {
              Text(
                when {
                  model.editing != null -> "Изменить сообщение"
                  model.currentConversation?.isAi == true -> "Спросите нейросеть…"
                  else -> "Написать сообщение"
                },
                color = TextMuted,
              )
            },
            maxLines = 4,
            shape = RoundedCornerShape(20.dp),
            keyboardOptions = KeyboardOptions(imeAction = if (model.me?.enterToSend == true) ImeAction.Send else ImeAction.Default),
            keyboardActions = KeyboardActions(onSend = { model.send() }),
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
        }
        val ready = model.draft.isNotBlank() || model.pendingUploads.any { it.attachment != null }
        if (voiceDraft != null) {
          IconButton(onClick = model::sendVoiceDraft) {
            Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = "Отправить голосовое", tint = Brand)
          }
        } else if (!ready && canAttach && model.editing == null) {
          Icon(
            Icons.Filled.Mic,
            contentDescription = "Голосовое сообщение",
            tint = if (model.recording) Danger else Brand,
            modifier = Modifier
              .size(44.dp)
              .pointerInput(chat.channelId) {
                awaitEachGesture {
                  awaitFirstDown()
                  val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                    PackageManager.PERMISSION_GRANTED
                  if (!granted) {
                    recordPermission.launch(Manifest.permission.RECORD_AUDIO)
                    return@awaitEachGesture
                  }
                  model.startVoiceRecord()
                  try {
                    while (true) {
                      val event = awaitPointerEvent()
                      if (event.changes.all { it.changedToUpIgnoreConsumed() || !it.pressed }) break
                    }
                  } finally {
                    if (model.recording) model.finishVoiceRecord()
                  }
                }
              }
              .padding(10.dp),
          )
        } else {
          IconButton(onClick = model::send, enabled = ready && model.pendingUploads.none { it.attachment == null && it.error == null }) {
            Icon(Icons.AutoMirrored.Outlined.Send, contentDescription = "Отправить", tint = Brand)
          }
        }
      }
      }
    } else {
      Text(
        "Нет права писать в этот канал",
        color = TextMuted,
        modifier = Modifier.fillMaxWidth().background(SurfacePanel).padding(16.dp),
      )
    }
  }

  val selectedMessage = selected
  if (selectedMessage != null) {
    MessageActionSheet(
      message = selectedMessage,
      meId = model.me?.id,
      dm = chat.dm,
      canManage = canManage,
      onDismiss = { selected = null },
      onReply = { model.startReply(selectedMessage); selected = null },
      onForward = { model.startForward(selectedMessage); selected = null },
      onCopy = {
        context.getSystemService(ClipboardManager::class.java)
          ?.setPrimaryClip(ClipData.newPlainText("message", selectedMessage.content))
        selected = null
      },
      onEdit = { model.startEdit(selectedMessage); selected = null },
      onPin = { model.togglePin(selectedMessage); selected = null },
      onDelete = { model.deleteMessage(selectedMessage); selected = null },
      onReact = { emoji -> model.react(selectedMessage, emoji); selected = null },
      onReport = {
        reportTarget = selectedMessage
        selected = null
      },
    )
  }

  if (model.forwarding != null) {
    ForwardPickerSheet(model) { model.forwarding = null }
  }

  if (showSettings) {
    ChatSettingsSheet(model, chat, onDismiss = { showSettings = false })
  }
  if (model.showSearch) {
    SearchSheet(model, chat) { model.showSearch = false }
  }
  if (model.showPins) {
    PinsSheet(model) { model.showPins = false }
  }
  if (model.showMedia) {
    MediaSheet(model) { model.showMedia = false }
  }
  reportTarget?.let { target ->
    ReportDialog(
      message = target,
      busy = model.busy,
      onDismiss = { reportTarget = null },
      onSend = { comment ->
        model.reportMessage(target, comment) { reportTarget = null }
      },
    )
  }

  val lightbox = preview
  if (lightbox != null) {
    val gallery = model.messages.flatMap { message ->
      message.attachments.filter { it.isImage && it.url.isNotBlank() }.map { attachment ->
        ViewerMedia(attachment.id, attachment.url, attachment.filename, attachment.contentType, attachment.spoiler)
      }
    }.ifEmpty {
      listOf(ViewerMedia(lightbox.id, lightbox.url, lightbox.filename, lightbox.contentType, lightbox.spoiler))
    }
    MediaViewer(items = gallery, currentId = lightbox.id, onClose = { preview = null })
  }
}

@Composable
private fun MentionSuggestions(model: AppViewModel, chat: Screen.Chat) {
  val draft = model.draft
  val at = draft.lastIndexOf('@')
  val hash = draft.lastIndexOf('#')
  val trigger = maxOf(at, hash)
  if (trigger < 0) return
  if (trigger > 0 && !draft[trigger - 1].isWhitespace()) return
  val term = draft.substring(trigger + 1)
  if (term.contains(' ') || term.length > 32) return
  if (draft[trigger] == '@') {
    val matches = model.members.filter {
      it.label.contains(term, true) || it.user.username.contains(term, true)
    }.take(6)
    if (matches.isEmpty() && term.isNotEmpty()) return
    Column(Modifier.fillMaxWidth().background(SurfacePanel).padding(horizontal = 12.dp)) {
      if ("everyone".startsWith(term) && term.isNotEmpty() && model.canPerm(Perm.MENTION_EVERYONE)) {
        Text(
          "@everyone",
          color = Brand,
          modifier = Modifier.fillMaxWidth().clickable {
            model.updateDraft(draft.substring(0, trigger) + "@everyone ")
          }.padding(vertical = 8.dp),
        )
      }
      matches.forEach { member ->
        Row(
          Modifier.fillMaxWidth().clickable {
            model.updateDraft(draft.substring(0, trigger) + "<@${member.user.id}> ")
          }.padding(vertical = 6.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          UserAvatar(member.user, 24.dp)
          Spacer(Modifier.width(8.dp))
          Text(member.label, color = TextPrimary, fontSize = 14.sp)
        }
      }
    }
  } else if (!chat.dm) {
    val matches = model.serverDetail?.channels.orEmpty()
      .filter { it.name.contains(term, true) }
      .take(6)
    if (matches.isEmpty()) return
    Column(Modifier.fillMaxWidth().background(SurfacePanel).padding(horizontal = 12.dp)) {
      matches.forEach { channel ->
        Text(
          "#${channel.name}",
          color = Brand,
          modifier = Modifier.fillMaxWidth().clickable {
            model.updateDraft(draft.substring(0, trigger) + "<#${channel.id}> ")
          }.padding(vertical = 8.dp),
        )
      }
    }
  }
}

@Composable
private fun EmojiPickerSheet(onPick: (String) -> Unit) {
  LazyVerticalGrid(
    columns = GridCells.Adaptive(44.dp),
    modifier = Modifier
      .fillMaxWidth()
      .height(180.dp)
      .background(SurfacePanel)
      .padding(8.dp),
  ) {
    items(EmojiGrid) { emoji ->
      Text(
        emoji,
        fontSize = 22.sp,
        modifier = Modifier.padding(6.dp).clickable { onPick(emoji) },
      )
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
          if (pending.mime.startsWith("image/") && pending.error == null) {
            IconButton(onClick = { model.togglePendingSpoiler(pending.localId) }, modifier = Modifier.size(28.dp)) {
              Icon(
                Icons.Outlined.VisibilityOff,
                contentDescription = "Спойлер",
                tint = if (pending.spoiler) Brand else TextMuted,
                modifier = Modifier.size(16.dp),
              )
            }
          }
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
  isGroupStart: Boolean,
  model: AppViewModel,
  onLongPress: () -> Unit,
  onOpenProfile: () -> Unit,
  onOpenAttachment: (Attachment) -> Unit,
) {
  val conversation = model.currentConversation
  val showReceipt =
    message.authorId == model.me?.id &&
      conversation?.showsReceipts == true &&
      !message.system
  val readReceipt = showReceipt &&
    !conversation.peerLastReadAt.isNullOrBlank() &&
    conversation.peerLastReadAt!! >= message.createdAt

  Row(
    modifier = Modifier
      .fillMaxWidth()
      .combinedClickable(onClick = {}, onLongClick = onLongPress)
      .padding(
        horizontal = 12.dp,
        vertical = if (isGroupStart) 6.dp else 1.dp,
      ),
    horizontalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    if (isGroupStart) {
      Box(Modifier.clickable(onClick = onOpenProfile)) {
        UserAvatar(message.author, 40.dp, model.statusOf(message.authorId, message.author.status))
      }
    } else {
      Spacer(Modifier.width(40.dp))
    }
    Column(Modifier.weight(1f)) {
      if (isGroupStart) {
        Row(verticalAlignment = Alignment.Bottom) {
          Text(
            message.author.label,
            color = TextPrimary,
            fontWeight = FontWeight.SemiBold,
            fontSize = 15.sp,
            modifier = Modifier.clickable(onClick = onOpenProfile),
          )
          Spacer(Modifier.width(8.dp))
          Text(formatTime(message.createdAt), color = TextMuted, fontSize = 12.sp)
          if (showReceipt) {
            Icon(
              if (readReceipt) Icons.Filled.DoneAll else Icons.Filled.Done,
              contentDescription = if (readReceipt) "Прочитано" else "Доставлено",
              tint = if (readReceipt) Brand else TextMuted,
              modifier = Modifier.padding(start = 4.dp).size(14.dp),
            )
          }
          if (message.editedAt != null) {
            Spacer(Modifier.width(6.dp))
            Text("изменено", color = TextMuted, fontSize = 11.sp)
          }
          if (message.pinned) {
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Outlined.PushPin, contentDescription = null, tint = TextMuted, modifier = Modifier.size(12.dp))
          }
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
      val forwarded = message.forwardedFrom
      if (forwarded != null) {
        Text(
          "Переслано от ${forwarded.author?.label ?: "пользователя"}",
          color = TextMuted,
          fontSize = 12.sp,
          modifier = Modifier.padding(top = 2.dp),
        )
      }
      if (message.content.isNotBlank()) {
        Row(verticalAlignment = Alignment.Bottom) {
          Box(modifier = if (isGroupStart) Modifier else Modifier.padding(top = 1.dp)) {
            MessageBody(message.content)
          }
          if (!isGroupStart && showReceipt) {
            Icon(
              if (readReceipt) Icons.Filled.DoneAll else Icons.Filled.Done,
              contentDescription = if (readReceipt) "Прочитано" else "Доставлено",
              tint = if (readReceipt) Brand else TextMuted,
              modifier = Modifier.padding(start = 4.dp).size(14.dp),
            )
          }
          if (!isGroupStart && message.editedAt != null) {
            Spacer(Modifier.width(6.dp))
            Text("изменено", color = TextMuted, fontSize = 11.sp)
          }
          if (!isGroupStart && message.pinned) {
            Spacer(Modifier.width(6.dp))
            Icon(Icons.Outlined.PushPin, contentDescription = null, tint = TextMuted, modifier = Modifier.size(12.dp))
          }
        }
      }
      message.attachments.forEach { attachment ->
        when {
          attachment.isImage && attachment.url.isNotBlank() -> {
            SpoilerImage(
              url = attachment.url,
              filename = attachment.filename,
              spoiler = attachment.spoiler,
              modifier = Modifier
                .padding(top = 6.dp)
                .fillMaxWidth()
                .heightIn(min = 120.dp, max = 280.dp)
                .clip(RoundedCornerShape(8.dp)),
              onOpen = { onOpenAttachment(attachment) },
            )
          }
          attachment.isVideo -> {
            Text(
              "Видео: ${attachment.filename.ifBlank { "файл" }}",
              color = Brand,
              fontSize = 13.sp,
              modifier = Modifier.padding(top = 4.dp).clickable { onOpenAttachment(attachment) },
            )
          }
          attachment.isAudio -> {
            VoiceBubble(attachment)
          }
          else -> {
            Text(
              attachment.filename.ifBlank { "Вложение" },
              color = Brand,
              fontSize = 13.sp,
              modifier = Modifier.padding(top = 4.dp).clickable { onOpenAttachment(attachment) },
            )
          }
        }
      }
      message.previews.forEach { card -> PreviewCard(card) }
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

@Composable
private fun PreviewCard(preview: LinkPreview) {
  val context = LocalContext.current
  Column(
    modifier = Modifier
      .padding(top = 8.dp)
      .clip(RoundedCornerShape(8.dp))
      .background(SurfaceDeep)
      .clickable {
        if (preview.url.isNotBlank()) {
          runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(preview.url))) }
        }
      }
      .padding(10.dp),
  ) {
    preview.siteName?.let { Text(it, color = TextMuted, fontSize = 11.sp) }
    preview.title?.let { Text(it, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 14.sp) }
    preview.description?.let { Text(it, color = TextMuted, fontSize = 13.sp, maxLines = 3, overflow = TextOverflow.Ellipsis) }
    if (!preview.imageUrl.isNullOrBlank()) {
      AsyncImage(
        model = preview.imageUrl,
        contentDescription = null,
        modifier = Modifier.padding(top = 6.dp).fillMaxWidth().heightIn(max = 160.dp).clip(RoundedCornerShape(6.dp)),
        contentScale = ContentScale.Crop,
      )
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MessageActionSheet(
  message: Message,
  meId: String?,
  dm: Boolean,
  canManage: Boolean,
  onDismiss: () -> Unit,
  onReply: () -> Unit,
  onForward: () -> Unit,
  onCopy: () -> Unit,
  onEdit: () -> Unit,
  onPin: () -> Unit,
  onDelete: () -> Unit,
  onReact: (String) -> Unit,
  onReport: () -> Unit,
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
    SheetRow(Icons.AutoMirrored.Outlined.Forward, "Переслать", onForward)
    if (message.content.isNotBlank()) SheetRow(Icons.Outlined.ContentCopy, "Копировать текст", onCopy)
    if (own) SheetRow(Icons.Outlined.Edit, "Изменить сообщение", onEdit)
    if (!dm) SheetRow(Icons.Outlined.PushPin, if (message.pinned) "Открепить сообщение" else "Закрепить сообщение", onPin)
    if (own || canManage) SheetRow(Icons.Outlined.Delete, "Удалить сообщение", onDelete, danger = true)
    if (!own) SheetRow(Icons.Outlined.Flag, "Пожаловаться", onReport, danger = true)
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
    people.take(20).forEach { user ->
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .clickable { model.openProfile(user.id); onDismiss() }
          .padding(horizontal = 20.dp, vertical = 8.dp),
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchSheet(model: AppViewModel, chat: Screen.Chat, onDismiss: () -> Unit) {
  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    containerColor = SurfacePanel,
  ) {
    Text(
      if (chat.dm) "Поиск: ${chat.title}" else "Поиск ${chat.title}",
      color = TextPrimary,
      fontWeight = FontWeight.SemiBold,
      modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
    )
    OutlinedTextField(
      value = model.messageSearch,
      onValueChange = model::searchInChat,
      modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
      placeholder = { Text("Поиск сообщений…", color = TextMuted) },
      singleLine = true,
      colors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = TextPrimary,
        unfocusedTextColor = TextPrimary,
        cursorColor = Brand,
      ),
    )
    if (model.messageSearch.trim().length < 2) {
      Text("Введите хотя бы два символа.", color = TextMuted, modifier = Modifier.padding(20.dp))
    } else if (model.messageHits.isEmpty()) {
      Text("Ничего не найдено.", color = TextMuted, modifier = Modifier.padding(20.dp))
    } else {
      Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        model.messageHits.take(30).forEach { message ->
          Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text("${message.author.label} · ${formatTime(message.createdAt)}", color = TextMuted, fontSize = 12.sp)
            Text(message.content.ifBlank { "Вложение" }, color = TextPrimary, maxLines = 3, overflow = TextOverflow.Ellipsis)
          }
        }
      }
    }
    Spacer(Modifier.height(24.dp))
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PinsSheet(model: AppViewModel, onDismiss: () -> Unit) {
  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    containerColor = SurfacePanel,
  ) {
    Text(
      "Закреплённые сообщения",
      color = TextPrimary,
      fontWeight = FontWeight.SemiBold,
      modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
    )
    if (model.pins.isEmpty()) {
      Text("Пока ничего не закреплено.", color = TextMuted, modifier = Modifier.padding(20.dp))
    } else {
      Column(Modifier.padding(horizontal = 16.dp)) {
        model.pins.forEach { message ->
          Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
            Text(message.author.label, color = TextPrimary, fontWeight = FontWeight.SemiBold)
            Text(message.content.ifBlank { "Вложение" }, color = TextMuted, maxLines = 4)
          }
        }
      }
    }
    Spacer(Modifier.height(24.dp))
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
private val dayMonthFmt = DateTimeFormatter.ofPattern("d MMMM", Locale("ru"))
private val dayMonthYearFmt = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("ru"))

private fun formatTime(iso: String): String {
  return runCatching { timeFmt.format(Instant.parse(iso)) }.getOrElse { "" }
}

private fun dayKey(iso: String): String {
  return runCatching {
    Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate().toString()
  }.getOrElse { "" }
}

/** True when the row should show avatar, name, and time (first message in a burst). */
private fun isMessageGroupStart(reversedMessages: List<Message>, index: Int): Boolean {
  if (index >= reversedMessages.lastIndex) return true
  val message = reversedMessages[index]
  val older = reversedMessages[index + 1]
  if (older.authorId != message.authorId) return true
  if (dayKey(older.createdAt) != dayKey(message.createdAt)) return true
  val gap = runCatching {
    Instant.parse(message.createdAt).toEpochMilli() - Instant.parse(older.createdAt).toEpochMilli()
  }.getOrElse { MESSAGE_GROUP_WINDOW_MS }
  if (gap >= MESSAGE_GROUP_WINDOW_MS) return true
  if (message.system || older.system) return true
  if (message.replyTo != null) return true
  return false
}

private fun formatDayLabel(iso: String): String {
  val date = runCatching {
    Instant.parse(iso).atZone(ZoneId.systemDefault()).toLocalDate()
  }.getOrElse { return "" }
  val today = LocalDate.now(ZoneId.systemDefault())
  return when {
    date.isEqual(today) -> "Сегодня"
    date.isEqual(today.minusDays(1)) -> "Вчера"
    date.year == today.year -> dayMonthFmt.format(date)
    else -> dayMonthYearFmt.format(date)
  }
}

@Composable
private fun DayDivider(label: String) {
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .padding(horizontal = 16.dp, vertical = 12.dp),
    contentAlignment = Alignment.Center,
  ) {
    HorizontalDivider(
      modifier = Modifier.fillMaxWidth(),
      color = SurfaceDeep,
    )
    Text(
      text = label,
      color = TextMuted,
      fontSize = 11.sp,
      fontWeight = FontWeight.SemiBold,
      modifier = Modifier
        .background(SurfaceRaised)
        .padding(horizontal = 8.dp),
    )
  }
}

private fun formatVoiceClock(ms: Long): String {
  val total = (ms / 1000).coerceAtLeast(0)
  val minutes = total / 60
  val seconds = total % 60
  return "$minutes:${seconds.toString().padStart(2, '0')}"
}

@Composable
private fun VoiceWaveform(samples: List<Float>, modifier: Modifier = Modifier) {
  val bars = remember(samples) { downsampleWaveform(samples, 36) }
  Canvas(modifier = modifier.height(28.dp).fillMaxWidth()) {
    if (bars.isEmpty()) return@Canvas
    val gap = 2.dp.toPx()
    val barWidth = ((size.width - gap * (bars.size - 1)) / bars.size).coerceAtLeast(2.dp.toPx())
    bars.forEachIndexed { index, amplitude ->
      val barHeight = (size.height * amplitude.coerceIn(0.12f, 1f)).coerceAtLeast(4.dp.toPx())
      val x = index * (barWidth + gap)
      val y = (size.height - barHeight) / 2f
      drawRoundRect(
        color = Brand,
        topLeft = Offset(x, y),
        size = Size(barWidth, barHeight),
        cornerRadius = CornerRadius(barWidth / 2f, barWidth / 2f),
      )
    }
  }
}

private fun downsampleWaveform(samples: List<Float>, bars: Int): List<Float> {
  if (samples.isEmpty()) return List(bars) { 0.2f }
  if (samples.size <= bars) return samples
  val bucket = samples.size.toFloat() / bars
  return List(bars) { index ->
    val start = (index * bucket).toInt()
    val end = (((index + 1) * bucket).toInt()).coerceAtMost(samples.size)
    var peak = 0.12f
    for (i in start until end.coerceAtLeast(start + 1)) {
      peak = maxOf(peak, samples[i])
    }
    peak
  }
}

@Composable
private fun VoiceDraftPreview(
  draft: VoiceDraft,
  onDiscard: () -> Unit,
  modifier: Modifier = Modifier,
) {
  var playing by remember(draft.file) { mutableStateOf(false) }
  val player = remember(draft.file) { MediaPlayer() }
  DisposableEffect(draft.file) {
    runCatching {
      player.setDataSource(draft.file.absolutePath)
      player.prepare()
    }
    player.setOnCompletionListener { playing = false }
    onDispose {
      runCatching { player.stop() }
      player.release()
      playing = false
    }
  }
  Row(
    modifier = modifier
      .clip(RoundedCornerShape(20.dp))
      .background(SurfaceDeep)
      .padding(horizontal = 6.dp, vertical = 6.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    IconButton(onClick = {
      if (playing) {
        runCatching { player.pause() }
        playing = false
      } else {
        runCatching { player.start() }
        playing = true
      }
    }) {
      Icon(
        if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
        contentDescription = if (playing) "Пауза" else "Прослушать",
        tint = Brand,
      )
    }
    VoiceWaveform(draft.samples, Modifier.weight(1f))
    Text(
      formatVoiceClock(draft.durationMs.toLong()),
      color = TextMuted,
      fontSize = 12.sp,
      modifier = Modifier.padding(horizontal = 6.dp),
    )
    IconButton(onClick = {
      runCatching { player.stop() }
      onDiscard()
    }) {
      Icon(Icons.Outlined.Delete, contentDescription = "Удалить голосовое", tint = Danger)
    }
  }
}

@Composable
private fun VoiceBubble(attachment: Attachment) {
  var playing by remember { mutableStateOf(false) }
  val player = remember { MediaPlayer() }
  DisposableEffect(attachment.url) {
    runCatching {
      player.setDataSource(attachment.url)
      player.prepareAsync()
    }
    player.setOnCompletionListener { playing = false }
    onDispose {
      runCatching { player.stop() }
      player.release()
    }
  }
  val seconds = ((attachment.durationMs ?: 0) / 1000).coerceAtLeast(1)
  Row(
    modifier = Modifier
      .padding(top = 6.dp)
      .clip(RoundedCornerShape(16.dp))
      .background(SurfaceDeep)
      .clickable {
        if (playing) {
          runCatching { player.pause() }
          playing = false
        } else {
          runCatching { player.start() }
          playing = true
        }
      }
      .padding(horizontal = 12.dp, vertical = 8.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(if (playing) "❚❚" else "▶", color = Brand, fontSize = 16.sp)
    Spacer(Modifier.width(8.dp))
    Text("Голосовое · ${seconds}с", color = TextPrimary, fontSize = 14.sp)
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ForwardPickerSheet(model: AppViewModel, onDismiss: () -> Unit) {
  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    containerColor = SurfacePanel,
  ) {
    Text(
      "Переслать в…",
      color = TextPrimary,
      fontWeight = FontWeight.SemiBold,
      fontSize = 16.sp,
      modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
    )
    model.forwardTargets.forEach { target ->
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .clickable { model.forwardTo(target.id, target.dm) }
          .padding(horizontal = 20.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        if (target.subtitle == "Сохранённые") {
          Icon(Icons.Outlined.Bookmark, contentDescription = null, tint = Brand)
          Spacer(Modifier.width(10.dp))
        } else if (target.subtitle == "Нейросеть") {
          Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = AiAccent)
          Spacer(Modifier.width(10.dp))
        }
        Column {
          Text(target.title, color = TextPrimary, fontSize = 15.sp)
          Text(target.subtitle, color = TextMuted, fontSize = 12.sp)
        }
      }
    }
    if (model.forwardTargets.isEmpty()) {
      Text("Загрузка…", color = TextMuted, modifier = Modifier.padding(20.dp))
    }
    Spacer(Modifier.height(16.dp))
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MediaSheet(model: AppViewModel, onDismiss: () -> Unit) {
  var previewId by remember { mutableStateOf<String?>(null) }
  ModalBottomSheet(
    onDismissRequest = onDismiss,
    sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
    containerColor = SurfacePanel,
  ) {
    Text(
      "Медиа чата",
      color = TextPrimary,
      fontWeight = FontWeight.SemiBold,
      fontSize = 16.sp,
      modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
    )
    if (model.chatMedia.isEmpty()) {
      Text("Пока нет фото и видео", color = TextMuted, modifier = Modifier.padding(20.dp))
    } else {
      LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        modifier = Modifier.fillMaxWidth().heightIn(max = 480.dp),
        contentPadding = PaddingValues(8.dp),
      ) {
        items(model.chatMedia, key = { it.id }) { item ->
          SpoilerImage(
            url = item.url,
            filename = item.filename,
            spoiler = item.spoiler,
            modifier = Modifier
              .padding(2.dp)
              .fillMaxWidth()
              .height(110.dp)
              .clip(RoundedCornerShape(6.dp)),
            onOpen = { previewId = item.id },
          )
        }
      }
    }
    Spacer(Modifier.height(16.dp))
  }
  previewId?.let { id ->
    MediaViewer(
      items = model.chatMedia.map {
        ViewerMedia(it.id, it.url, it.filename, it.contentType, it.spoiler)
      },
      currentId = id,
      onClose = { previewId = null },
    )
  }
}

@Composable
private fun ReportDialog(
  message: Message,
  busy: Boolean,
  onDismiss: () -> Unit,
  onSend: (String) -> Unit,
) {
  var comment by remember { mutableStateOf("") }
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Пожаловаться") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(message.author.label, color = TextMuted, fontSize = 12.sp)
        if (message.content.isNotBlank()) {
          Text(message.content, color = TextPrimary, fontSize = 14.sp, maxLines = 6)
        }
        message.attachments.filter { it.isImage }.forEach { attachment ->
          AsyncImage(
            model = attachment.url,
            contentDescription = attachment.filename,
            modifier = Modifier.fillMaxWidth().heightIn(max = 160.dp).clip(RoundedCornerShape(8.dp)),
            contentScale = ContentScale.Crop,
          )
        }
        OutlinedTextField(
          value = comment,
          onValueChange = { comment = it.take(1000) },
          label = { Text("Сообщение админу") },
          minLines = 3,
        )
      }
    },
    confirmButton = {
      TextButton(
        onClick = { onSend(comment) },
        enabled = comment.trim().isNotEmpty() && !busy,
      ) { Text("Отправить", color = Brand) }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
  )
}
