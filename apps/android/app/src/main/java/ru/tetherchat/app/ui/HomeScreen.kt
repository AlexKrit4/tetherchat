package ru.tetherchat.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AlternateEmail
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.PushPin
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Tag
import androidx.compose.material.icons.outlined.PersonOff
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import coil.compose.AsyncImage
import ru.tetherchat.app.data.Channel
import ru.tetherchat.app.data.DirectConversation
import ru.tetherchat.app.data.Perm

@Composable
fun HomeScreen(model: AppViewModel) {
  Column(Modifier.fillMaxSize().background(SurfaceDeep)) {
    if (!model.connected) {
      Text(
        "Нет соединения — переподключаемся…",
        color = Color.White,
        fontSize = 13.sp,
        modifier = Modifier
          .fillMaxWidth()
          .background(Danger)
          .statusBarsPadding()
          .padding(8.dp),
      )
    }
    Row(
      modifier = Modifier
        .weight(1f)
        .fillMaxWidth()
        .then(if (model.connected) Modifier.statusBarsPadding() else Modifier)
        .navigationBarsPadding(),
    ) {
      ServerRail(model)
      Column(
        modifier = Modifier
          .weight(1f)
          .fillMaxHeight()
          .background(SurfacePanel),
      ) {
        ServerHeader(model)
        Box(Modifier.weight(1f)) {
          when {
            model.friendsTabOpen -> FriendsHomeList(model)
            model.selectedServerId == null -> DmList(model)
            else -> ChannelList(model)
          }
        }
        UserFooter(model)
      }
    }
  }

  if (model.showCreateServer) {
    TextPromptDialog("Новый сервер", "Название", model, confirm = "Создать", onConfirm = model::createServer) {
      model.showCreateServer = false
    }
  }
  if (model.showJoinServer) {
    TextPromptDialog("Присоединиться", "Код или ссылка приглашения", model, confirm = "Войти", onConfirm = model::joinServer) {
      model.showJoinServer = false
    }
  }
  if (model.showCreateChannel) {
    TextPromptDialog("Новый канал", "Название", model, confirm = "Создать", onConfirm = model::createChannel) {
      model.showCreateChannel = false
    }
  }
  if (model.showCreateCategory) {
    TextPromptDialog("Новая категория", "Название", model, confirm = "Создать", onConfirm = model::createCategory) {
      model.showCreateCategory = false
    }
  }
  if (model.showChannelSettings) {
    ChannelSettingsDialog(model)
  }
  if (model.showNewDm) NewDmDialog(model)
}

@Composable
private fun ServerHeader(model: AppViewModel) {
  var menu by remember { mutableStateOf(false) }
  val title = when {
    model.friendsTabOpen -> "Друзья"
    model.selectedServerId == null -> "Личные сообщения"
    else -> model.serverDetail?.name ?: "Сервер"
  }
  Row(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text(
      title,
      color = TextPrimary,
      fontWeight = FontWeight.SemiBold,
      fontSize = 16.sp,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      modifier = Modifier.weight(1f).clickable(enabled = model.selectedServerId != null) { menu = true },
    )
    if (model.selectedServerId == null && !model.friendsTabOpen) {
      IconButton(onClick = { model.showNewDm = true; model.dialogText = ""; model.searchQuery = ""; model.selectedDmUsers = emptyList() }) {
        Icon(Icons.Outlined.Add, contentDescription = "Добавить друга или создать секретный чат", tint = TextMuted)
      }
    } else {
      IconButton(onClick = { menu = true }) {
        Icon(Icons.Outlined.ExpandMore, contentDescription = "Меню сервера", tint = TextMuted)
      }
      DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
        if (model.canPerm(Perm.CREATE_INVITE) || model.canPerm(Perm.MANAGE_SERVER) || model.isOwner()) {
          DropdownMenuItem(text = { Text("Пригласить людей") }, onClick = {
            menu = false
            model.createInviteLink()
          })
        }
        if (model.canPerm(Perm.MANAGE_CHANNELS) || model.isOwner()) {
          DropdownMenuItem(text = { Text("Создать канал") }, onClick = {
            menu = false
            model.dialogText = ""
            model.showCreateChannel = true
          })
          DropdownMenuItem(text = { Text("Создать категорию") }, onClick = {
            menu = false
            model.dialogText = ""
            model.showCreateCategory = true
          })
        }
        if (model.canPerm(Perm.MANAGE_SERVER) || model.isOwner()) {
          DropdownMenuItem(text = { Text("Настройки сервера") }, onClick = {
            menu = false
            model.openServerSettings()
          })
        }
        DropdownMenuItem(text = { Text("Участники") }, onClick = {
          menu = false
          model.openMembers()
        })
        if (!model.isOwner()) {
          DropdownMenuItem(text = { Text("Покинуть сервер", color = Danger) }, onClick = {
            menu = false
            model.leaveServer()
          })
        }
      }
    }
  }
}

@Composable
private fun ServerRail(model: AppViewModel) {
  Column(
    modifier = Modifier
      .width(72.dp)
      .fillMaxHeight()
      .background(SurfaceDeep)
      .padding(vertical = 8.dp)
      .pointerInput(model.otherAccount?.userId) {
        var total = 0f
        var switched = false
        detectHorizontalDragGestures(
          onDragStart = {
            total = 0f
            switched = false
          },
          onHorizontalDrag = { _, dragAmount ->
            total += dragAmount
            if (!switched && total > 80f && model.otherAccount != null) {
              switched = true
              model.switchAccount()
            }
          },
        )
      },
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    val dmUnread = model.dms.any { model.unread(it.id) || model.mentions(it.id) > 0 }
    ServerIcon(
      selected = model.selectedServerId == null && !model.friendsTabOpen,
      onClick = model::selectDms,
      unread = dmUnread,
    ) {
      Icon(Icons.Outlined.AlternateEmail, contentDescription = "ЛС", tint = Color.White, modifier = Modifier.size(22.dp))
    }
    ServerIcon(selected = model.friendsTabOpen, onClick = model::selectFriends) {
      Icon(Icons.Outlined.People, contentDescription = "Друзья", tint = Color.White, modifier = Modifier.size(22.dp))
    }
    Box(Modifier.width(32.dp).height(2.dp).background(Color(0xFF3F4147), RoundedCornerShape(1.dp)))
    LazyColumn(
      modifier = Modifier.weight(1f),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(8.dp),
      contentPadding = PaddingValues(bottom = 8.dp),
    ) {
      items(model.servers, key = { it.id }) { server ->
        ServerIcon(
          selected = model.selectedServerId == server.id,
          onClick = { model.selectServer(server.id) },
          label = server.name,
          iconUrl = server.iconUrl,
          unread = model.serverUnread(server.id),
          mentions = model.serverMentions(server.id),
        )
      }
    }
    ServerIcon(selected = false, onClick = { model.dialogText = ""; model.showCreateServer = true }) {
      Text("+", color = Online, fontWeight = FontWeight.Bold, fontSize = 22.sp)
    }
    ServerIcon(selected = false, onClick = { model.dialogText = ""; model.showJoinServer = true }) {
      Text("→", color = Online, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    }
  }
}

@Composable
private fun ServerIcon(
  selected: Boolean,
  onClick: () -> Unit,
  label: String? = null,
  iconUrl: String? = null,
  unread: Boolean = false,
  mentions: Int = 0,
  content: (@Composable () -> Unit)? = null,
) {
  val shape = if (selected) RoundedCornerShape(16.dp) else CircleShape
  Box(contentAlignment = Alignment.Center) {
    Box(
      modifier = Modifier
        .size(48.dp)
        .clip(shape)
        .background(if (selected) Brand else SurfaceRaised)
        .clickable(onClick = onClick),
      contentAlignment = Alignment.Center,
    ) {
      when {
        content != null -> content()
        !iconUrl.isNullOrBlank() -> AsyncImage(iconUrl, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
        else -> Text(label?.take(1)?.uppercase() ?: "?", color = Color.White, fontWeight = FontWeight.SemiBold)
      }
    }
    if (mentions > 0) {
      Box(
        modifier = Modifier
          .align(Alignment.BottomEnd)
          .size(18.dp)
          .clip(CircleShape)
          .background(Danger),
        contentAlignment = Alignment.Center,
      ) {
        Text(if (mentions > 9) "9+" else mentions.toString(), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
      }
    } else if (unread && !selected) {
      Box(
        modifier = Modifier
          .align(Alignment.CenterStart)
          .width(4.dp)
          .height(8.dp)
          .clip(RoundedCornerShape(2.dp))
          .background(Color.White),
      )
    }
  }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ChannelList(model: AppViewModel) {
  val detail = model.serverDetail ?: return
  val grouped = detail.categories.sortedBy { it.position }.map { category ->
    Triple(category.id, category.name, detail.channels.filter { it.categoryId == category.id }.sortedBy { it.position })
  } + listOf(
    Triple("uncat", "", detail.channels.filter { it.categoryId == null }.sortedBy { it.position }),
  )
  LazyColumn(contentPadding = PaddingValues(bottom = 12.dp)) {
    grouped.forEach { (id, name, channels) ->
      if (channels.isEmpty() && name.isBlank()) return@forEach
      val collapsed = model.collapsedCategories[id] == true
      if (name.isNotBlank()) {
        item(key = "cat-$id") {
          Text(
            (if (collapsed) "▸ " else "▾ ") + name.uppercase(),
            color = TextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
              .fillMaxWidth()
              .clickable { model.toggleCollapsed(id) }
              .padding(horizontal = 16.dp, vertical = 8.dp),
          )
        }
      }
      if (!collapsed) {
        items(channels, key = { it.id }) { channel ->
          ChannelRow(
            channel = channel,
            unread = model.unread(channel.id),
            mentions = model.mentions(channel.id),
            onClick = { model.openChannel(channel) },
            onLongClick = { model.openChannelSettings(channel) },
          )
        }
      }
    }
  }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ChannelRow(
  channel: Channel,
  unread: Boolean,
  mentions: Int,
  onClick: () -> Unit,
  onLongClick: () -> Unit,
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .combinedClickable(onClick = onClick, onLongClick = onLongClick)
      .padding(horizontal = 8.dp, vertical = 4.dp)
      .clip(RoundedCornerShape(8.dp))
      .padding(horizontal = 8.dp, vertical = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(Icons.Outlined.Tag, contentDescription = null, tint = if (unread) TextPrimary else TextMuted, modifier = Modifier.size(18.dp))
    Spacer(Modifier.width(8.dp))
    Text(
      channel.name,
      color = if (unread) TextPrimary else TextMuted,
      fontSize = 16.sp,
      fontWeight = if (unread) FontWeight.SemiBold else FontWeight.Normal,
      maxLines = 1,
      overflow = TextOverflow.Ellipsis,
      modifier = Modifier.weight(1f),
    )
    if (mentions > 0) {
      Box(
        Modifier.size(18.dp).clip(CircleShape).background(Danger),
        contentAlignment = Alignment.Center,
      ) {
        Text(mentions.toString(), color = Color.White, fontSize = 10.sp)
      }
    }
  }
}

@Composable
private fun DmList(model: AppViewModel) {
  val meId = model.me?.id.orEmpty()
  LazyColumn(contentPadding = PaddingValues(bottom = 12.dp)) {
    item {
      Text(
        "СООБЩЕНИЯ",
        color = TextMuted,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
      )
    }
    items(model.dms, key = { it.id }) { conversation ->
      DmRow(conversation, meId, model) { model.openDm(conversation) }
    }
  }
}

@Composable
private fun FriendsHomeList(model: AppViewModel) {
  LazyColumn(contentPadding = PaddingValues(bottom = 12.dp)) {
    item {
      Text(
        "ДРУЗЬЯ · ${model.friends.size}",
        color = TextMuted,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
      )
    }
    items(model.friends, key = { it.id }) { friend ->
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .clickable { model.startDm(friend) }
          .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        UserAvatar(friend, 42.dp, model.statusOf(friend.id, friend.status))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
          PlusName(friend, fontWeight = FontWeight.Medium, fontSize = 16.sp)
          Text("@${friend.username}", color = TextMuted, fontSize = 13.sp)
        }
        Icon(Icons.Outlined.ChatBubbleOutline, contentDescription = "Открыть чат", tint = TextMuted)
      }
    }
    if (model.friends.isEmpty()) {
      item {
        Text(
          "Список друзей пока пуст",
          color = TextMuted,
          modifier = Modifier.fillMaxWidth().padding(24.dp),
        )
      }
    }
  }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun DmRow(
  conversation: DirectConversation,
  meId: String,
  model: AppViewModel,
  onClick: () -> Unit,
) {
  val other = conversation.members.firstOrNull { it.id != meId } ?: conversation.members.firstOrNull()
  val unread = model.unread(conversation.id) || model.mentions(conversation.id) > 0
  var menu by remember { mutableStateOf(false) }
  Box {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .combinedClickable(onClick = onClick, onLongClick = { if (!conversation.lockedInList) menu = true })
        .padding(horizontal = 12.dp, vertical = 8.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      if (conversation.isSaved) {
        Box(
          Modifier.size(40.dp).clip(CircleShape).background(Brand),
          contentAlignment = Alignment.Center,
        ) {
          Icon(Icons.Outlined.Bookmark, contentDescription = null, tint = Color.White)
        }
      } else if (conversation.isAi) {
        Box(
          Modifier.size(40.dp).clip(CircleShape).background(AiAccent),
          contentAlignment = Alignment.Center,
        ) {
          Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = Color.White)
        }
      } else if (conversation.isGroup) {
        Box(Modifier.size(40.dp).clip(CircleShape).background(Brand), contentAlignment = Alignment.Center) {
          Text(conversation.title(meId).take(1).uppercase(), color = Color.White, fontWeight = FontWeight.SemiBold)
        }
      } else if (other != null) {
        UserAvatar(other, 40.dp, model.statusOf(other.id, other.status))
      } else {
        Box(Modifier.size(40.dp).clip(CircleShape).background(Brand))
      }
      Spacer(Modifier.width(12.dp))
      if (conversation.isSecret) {
        Icon(Icons.Outlined.Lock, contentDescription = "Секретный чат", tint = Online, modifier = Modifier.size(15.dp))
        Spacer(Modifier.width(6.dp))
      }
      if (other != null && !conversation.isGroup && !conversation.isSaved && !conversation.isAi) {
        PlusName(
          other,
          name = conversation.title(meId),
          fontWeight = if (unread) FontWeight.SemiBold else FontWeight.Normal,
          modifier = Modifier.weight(1f),
        )
      } else {
        Text(
          conversation.title(meId),
          color = TextPrimary,
          fontSize = 16.sp,
          fontWeight = if (unread) FontWeight.SemiBold else FontWeight.Normal,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.weight(1f),
        )
      }
      if (conversation.pinned && !conversation.lockedInList) {
        Icon(Icons.Outlined.PushPin, contentDescription = null, tint = TextMuted, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(8.dp))
      }
      if (unread) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(Brand))
      }
    }
    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
      DropdownMenuItem(
        text = { Text(if (conversation.pinned) "Открепить" else "Закрепить") },
        onClick = {
          menu = false
          model.pinConversation(conversation, !conversation.pinned)
        },
        leadingIcon = { Icon(Icons.Outlined.PushPin, contentDescription = null) },
      )
      if (!conversation.isGroup && other != null && !conversation.isAi) {
        DropdownMenuItem(
          text = { Text("Заблокировать", color = Danger) },
          onClick = {
            menu = false
            model.blockUser(other.id)
          },
          leadingIcon = { Icon(Icons.Outlined.PersonOff, contentDescription = null, tint = Danger) },
        )
      }
    }
  }
}

@Composable
private fun UserFooter(model: AppViewModel) {
  val user = model.me ?: return
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(SurfaceDeep)
      .clickable(onClick = model::openSettings)
      .padding(horizontal = 12.dp, vertical = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    UserAvatar(user.asPublic(), 32.dp, model.statusOf(user.id, user.status))
    Spacer(Modifier.width(10.dp))
    Column(Modifier.weight(1f)) {
      PlusName(user.asPublic(), fontSize = 14.sp, fontWeight = FontWeight.Medium)
      Text(
        user.customStatus?.takeIf { it.isNotBlank() } ?: "@${user.username}",
        color = TextMuted,
        fontSize = 12.sp,
        maxLines = 1,
      )
    }
    IconButton(onClick = model::openIncomingFriends) {
      Box {
        Icon(Icons.Outlined.PersonAdd, contentDescription = "Заявки в друзья", tint = TextMuted)
        Box(Modifier.align(Alignment.TopEnd)) { FriendBadge(model.incomingFriendCount) }
      }
    }
    IconButton(onClick = model::openSettings) {
      Icon(Icons.Outlined.Settings, contentDescription = "Настройки", tint = TextMuted)
    }
  }
}

@Composable
private fun TextPromptDialog(
  title: String,
  label: String,
  model: AppViewModel,
  confirm: String,
  onConfirm: () -> Unit,
  onDismiss: () -> Unit,
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(title) },
    text = {
      OutlinedTextField(value = model.dialogText, onValueChange = { model.dialogText = it }, label = { Text(label) })
    },
    confirmButton = { TextButton(onClick = onConfirm) { Text(confirm, color = Brand) } },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
  )
}

@Composable
private fun ChannelSettingsDialog(model: AppViewModel) {
  val channel = model.channelForSettings ?: return
  var name by remember(channel.id) { mutableStateOf(channel.name) }
  var topic by remember(channel.id) { mutableStateOf(channel.topic.orEmpty()) }
  val context = LocalContext.current
  val canManage = model.canPerm(Perm.MANAGE_CHANNELS) || model.isOwner()
  AlertDialog(
    onDismissRequest = { model.showChannelSettings = false },
    title = { Text("#${channel.name}") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (canManage) {
          OutlinedTextField(name, { name = it }, label = { Text("Название") })
          OutlinedTextField(topic, { topic = it }, label = { Text("Тема") })
        } else {
          Text(channel.topic ?: "Без темы", color = TextMuted)
        }
        TextButton(onClick = {
          context.getSystemService(ClipboardManager::class.java)
            ?.setPrimaryClip(ClipData.newPlainText("link", "https://tetherchat.ru/channels/${channel.serverId}/${channel.id}"))
          model.showChannelSettings = false
        }) { Text("Копировать ссылку", color = Brand) }
      }
    },
    confirmButton = {
      if (canManage) {
        TextButton(onClick = { model.saveChannel(name, topic) }) { Text("Сохранить", color = Brand) }
      }
    },
    dismissButton = {
      Row {
        if (canManage) {
          TextButton(onClick = { model.deleteChannel() }) { Text("Удалить", color = Danger) }
        }
        TextButton(onClick = { model.showChannelSettings = false }) { Text("Закрыть") }
      }
    },
  )
}

@Composable
private fun NewDmDialog(model: AppViewModel) {
  var mode by remember { mutableStateOf("choice") }
  AlertDialog(
    onDismissRequest = { model.showNewDm = false; model.selectedDmUsers = emptyList() },
    title = {
      Text(
        when (mode) {
          "invite" -> "Пригласить в друзья"
          "secret" -> "Секретный чат"
          else -> "Что вы хотите сделать?"
        },
      )
    },
    text = {
      Column {
        if (mode == "choice") {
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(12.dp))
              .clickable { mode = "invite" }
              .background(SurfaceRaised)
              .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Icon(Icons.Outlined.PersonAdd, contentDescription = null, tint = Brand)
            Spacer(Modifier.width(12.dp))
            Text("Пригласить в друзья", color = TextPrimary, fontWeight = FontWeight.Medium)
          }
          Spacer(Modifier.height(10.dp))
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .clip(RoundedCornerShape(12.dp))
              .clickable { mode = "secret" }
              .background(SurfaceRaised)
              .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Icon(Icons.Outlined.Lock, contentDescription = null, tint = Online)
            Spacer(Modifier.width(12.dp))
            Text("Создать секретный чат", color = TextPrimary, fontWeight = FontWeight.Medium)
          }
        } else if (mode == "invite") {
          OutlinedTextField(
            value = model.searchQuery,
            onValueChange = model::searchPeople,
            label = { Text("Поиск пользователя") },
            singleLine = true,
          )
          Spacer(Modifier.height(8.dp))
          model.searchResults.filter { it.id != model.me?.id }.forEach { user ->
            Row(
              modifier = Modifier.fillMaxWidth().clickable { model.sendFriendRequest(user) }.padding(vertical = 8.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              UserAvatar(user, 32.dp, model.statusOf(user.id, user.status))
              Spacer(Modifier.width(10.dp))
              Column {
                Text(user.label, color = TextPrimary)
                Text("@${user.username}", color = TextMuted, fontSize = 12.sp)
              }
            }
          }
        } else {
          Text("Выберите друга", color = TextMuted, fontSize = 13.sp)
          model.friends.forEach { user ->
            Row(
              modifier = Modifier.fillMaxWidth().clickable { model.startSecretDm(user) }.padding(vertical = 10.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              UserAvatar(user, 36.dp, model.statusOf(user.id, user.status))
              Spacer(Modifier.width(10.dp))
              Column(Modifier.weight(1f)) {
                Text(user.label, color = TextPrimary)
                Text("@${user.username}", color = TextMuted, fontSize = 12.sp)
              }
              Icon(Icons.Outlined.Lock, contentDescription = null, tint = Online)
            }
          }
        }
      }
    },
    confirmButton = {},
    dismissButton = {
      Row {
        if (mode != "choice") TextButton(onClick = { mode = "choice" }) { Text("Назад") }
        TextButton(onClick = { model.showNewDm = false; model.selectedDmUsers = emptyList() }) { Text("Закрыть") }
      }
    },
  )
}
