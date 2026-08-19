package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AlternateEmail
import androidx.compose.material.icons.outlined.Tag
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ru.tetherchat.app.data.Channel
import ru.tetherchat.app.data.DirectConversation

@Composable
fun HomeScreen(model: AppViewModel) {
  Row(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    ServerRail(model)
    Column(
      modifier = Modifier
        .weight(1f)
        .fillMaxHeight()
        .background(SurfacePanel),
    ) {
      val title = if (model.selectedServerId == null) "Личные сообщения" else model.serverDetail?.name ?: "Сервер"
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(
          title,
          color = TextPrimary,
          fontWeight = FontWeight.SemiBold,
          fontSize = 16.sp,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
          modifier = Modifier.weight(1f),
        )
        if (model.selectedServerId == null) {
          IconButton(onClick = { model.showNewDm = true; model.dialogText = ""; model.searchQuery = "" }) {
            Icon(Icons.Outlined.Add, contentDescription = "Новый диалог", tint = TextMuted)
          }
        }
      }
      Box(Modifier.weight(1f)) {
        if (model.selectedServerId == null) DmList(model) else ChannelList(model)
      }
      UserFooter(model)
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
  if (model.showNewDm) NewDmDialog(model)
}

@Composable
private fun ServerRail(model: AppViewModel) {
  Column(
    modifier = Modifier
      .width(72.dp)
      .fillMaxHeight()
      .background(SurfaceDeep)
      .padding(vertical = 8.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    ServerIcon(
      selected = model.selectedServerId == null,
      onClick = model::selectDms,
    ) {
      Icon(Icons.Outlined.AlternateEmail, contentDescription = "ЛС", tint = Color.White, modifier = Modifier.size(22.dp))
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
  content: (@Composable () -> Unit)? = null,
) {
  val shape = if (selected) RoundedCornerShape(16.dp) else CircleShape
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
}

@Composable
private fun ChannelList(model: AppViewModel) {
  val detail = model.serverDetail ?: return
  val grouped = detail.categories.sortedBy { it.position }.map { category ->
    category.name to detail.channels.filter { it.categoryId == category.id }.sortedBy { it.position }
  } + listOf(
    "" to detail.channels.filter { it.categoryId == null }.sortedBy { it.position },
  )
  LazyColumn(contentPadding = PaddingValues(bottom = 12.dp)) {
    grouped.forEach { (name, channels) ->
      if (channels.isEmpty()) return@forEach
      if (name.isNotBlank()) {
        item(key = "cat-$name") {
          Text(
            name.uppercase(),
            color = TextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
          )
        }
      }
      items(channels, key = { it.id }) { channel ->
        ChannelRow(channel) { model.openChannel(channel) }
      }
    }
  }
}

@Composable
private fun ChannelRow(channel: Channel, onClick: () -> Unit) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .clickable(onClick = onClick)
      .padding(horizontal = 8.dp, vertical = 4.dp)
      .clip(RoundedCornerShape(8.dp))
      .padding(horizontal = 8.dp, vertical = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(Icons.Outlined.Tag, contentDescription = null, tint = TextMuted, modifier = Modifier.size(18.dp))
    Spacer(Modifier.width(8.dp))
    Text(channel.name, color = TextPrimary, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

@Composable
private fun DmList(model: AppViewModel) {
  val meId = model.me?.id.orEmpty()
  LazyColumn(contentPadding = PaddingValues(bottom = 12.dp)) {
    items(model.dms, key = { it.id }) { conversation ->
      DmRow(conversation, meId, model) { model.openDm(conversation) }
    }
  }
}

@Composable
private fun DmRow(
  conversation: DirectConversation,
  meId: String,
  model: AppViewModel,
  onClick: () -> Unit,
) {
  val other = conversation.members.firstOrNull { it.id != meId } ?: conversation.members.firstOrNull()
  Row(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    if (other != null) {
      UserAvatar(other, 40.dp, model.statusOf(other.id, other.status))
    } else {
      Box(Modifier.size(40.dp).clip(CircleShape).background(Brand))
    }
    Spacer(Modifier.width(12.dp))
    Text(conversation.title(meId), color = TextPrimary, fontSize = 16.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

@Composable
private fun UserFooter(model: AppViewModel) {
  val user = model.me ?: return
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(SurfaceDeep)
      .padding(horizontal = 12.dp, vertical = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    UserAvatar(user.asPublic(), 32.dp, model.statusOf(user.id, user.status))
    Spacer(Modifier.width(10.dp))
    Column(Modifier.weight(1f)) {
      Text(user.label, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1)
      Text("@${user.username}", color = TextMuted, fontSize = 12.sp, maxLines = 1)
    }
    IconButton(onClick = model::logout) {
      Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = "Выйти", tint = TextMuted)
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
private fun NewDmDialog(model: AppViewModel) {
  AlertDialog(
    onDismissRequest = { model.showNewDm = false },
    title = { Text("Новый диалог") },
    text = {
      Column {
        OutlinedTextField(
          value = model.searchQuery,
          onValueChange = model::searchPeople,
          label = { Text("Поиск по имени") },
          singleLine = true,
        )
        Spacer(Modifier.height(8.dp))
        model.searchResults.forEach { user ->
          Row(
            modifier = Modifier.fillMaxWidth().clickable { model.startDm(user) }.padding(vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            UserAvatar(user, 32.dp, model.statusOf(user.id, user.status))
            Spacer(Modifier.width(10.dp))
            Text(user.label, color = TextPrimary)
          }
        }
      }
    },
    confirmButton = {},
    dismissButton = { TextButton(onClick = { model.showNewDm = false }) { Text("Закрыть") } },
  )
}
