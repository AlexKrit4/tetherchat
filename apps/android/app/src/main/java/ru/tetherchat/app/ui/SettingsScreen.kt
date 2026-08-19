package ru.tetherchat.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.PersonOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val Statuses = listOf(
  "online" to "В сети",
  "idle" to "Отошёл",
  "dnd" to "Не беспокоить",
  "invisible" to "Невидимый",
)

@Composable
fun SettingsScreen(model: AppViewModel) {
  val user = model.me ?: return
  var displayName by rememberSaveable(user.id) { mutableStateOf(user.displayName.orEmpty()) }
  var customStatus by rememberSaveable(user.id) { mutableStateOf(user.customStatus.orEmpty()) }
  var bio by rememberSaveable(user.id) { mutableStateOf(user.bio.orEmpty()) }
  val pickAvatar = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
    if (uri != null) model.uploadAvatar(uri)
  }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding()
      .imePadding(),
  ) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(end = 8.dp)) {
      IconButton(onClick = model::back) {
        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад", tint = TextPrimary)
      }
      Text("Настройки профиля", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
    }
    Column(
      modifier = Modifier
        .weight(1f)
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 16.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        UserAvatar(user.asPublic(), 72.dp, model.statusOf(user.id, user.status))
        Spacer(Modifier.padding(12.dp))
        Column {
          TextButton(onClick = { pickAvatar.launch("image/*") }) { Text("Сменить аватар", color = Brand) }
          if (!user.avatarUrl.isNullOrBlank()) {
            TextButton(onClick = model::removeAvatar) { Text("Убрать", color = Danger) }
          }
        }
      }
      Field("Отображаемое имя", displayName, 32) { displayName = it }
      Field("Статус", customStatus, 128) { customStatus = it }
      Field("О себе", bio, 256, single = false) { bio = it }
      Text("Видимость", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        Statuses.forEach { (id, label) ->
          val selected = (model.me?.status ?: user.status) == id
          Text(
            label,
            color = if (selected) ColorWhite else TextMuted,
            fontSize = 12.sp,
            modifier = Modifier
              .background(if (selected) Brand else SurfacePanel, RoundedCornerShape(16.dp))
              .clickable { model.setStatus(id) }
              .padding(horizontal = 10.dp, vertical = 6.dp),
          )
        }
      }
      Button(
        onClick = { model.saveProfile(displayName, customStatus, bio) },
        enabled = !model.busy,
        colors = ButtonDefaults.buttonColors(containerColor = Brand),
        modifier = Modifier.fillMaxWidth(),
      ) {
        Text("Сохранить изменения")
      }
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .background(SurfacePanel, RoundedCornerShape(12.dp))
          .clickable(onClick = model::openBlacklist)
          .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Icon(Icons.Outlined.PersonOff, contentDescription = null, tint = TextMuted)
        Spacer(Modifier.padding(8.dp))
        Column(Modifier.weight(1f)) {
          Text("Чёрный список", color = TextPrimary, fontWeight = FontWeight.Medium)
          Text("Заблокированные пользователи", color = TextMuted, fontSize = 12.sp)
        }
        Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = TextMuted)
      }
      Button(
        onClick = model::logout,
        colors = ButtonDefaults.buttonColors(containerColor = Danger),
        modifier = Modifier.fillMaxWidth(),
      ) {
        Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null)
        Spacer(Modifier.padding(6.dp))
        Text("Выйти")
      }
      Spacer(Modifier.height(24.dp))
    }
  }
}

@Composable
fun BlacklistScreen(model: AppViewModel) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    Row(verticalAlignment = Alignment.CenterVertically) {
      IconButton(onClick = model::back) {
        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад", tint = TextPrimary)
      }
      Text("Чёрный список", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
    }
    if (model.blockedUsers.isEmpty()) {
      Text(
        "Пока никого нет.",
        color = TextMuted,
        modifier = Modifier.padding(24.dp),
      )
    } else {
      model.blockedUsers.forEach { user ->
        Row(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          UserAvatar(user, 40.dp, model.statusOf(user.id, user.status))
          Spacer(Modifier.padding(10.dp))
          Column(Modifier.weight(1f)) {
            Text(user.label, color = TextPrimary)
            Text("@${user.username}", color = TextMuted, fontSize = 12.sp)
          }
          TextButton(onClick = { model.unblockUser(user.id) }) {
            Text("Разблокировать", color = Brand)
          }
        }
      }
    }
  }
}

@Composable
private fun Field(label: String, value: String, max: Int, single: Boolean = true, onChange: (String) -> Unit) {
  OutlinedTextField(
    value = value,
    onValueChange = { if (it.length <= max) onChange(it) },
    label = { Text(label) },
    modifier = Modifier.fillMaxWidth(),
    singleLine = single,
    minLines = if (single) 1 else 3,
    colors = OutlinedTextFieldDefaults.colors(
      focusedTextColor = TextPrimary,
      unfocusedTextColor = TextPrimary,
      focusedContainerColor = SurfacePanel,
      unfocusedContainerColor = SurfacePanel,
      focusedBorderColor = Brand,
      unfocusedBorderColor = SurfaceRaised,
      cursorColor = Brand,
      focusedLabelColor = TextMuted,
      unfocusedLabelColor = TextMuted,
    ),
  )
}

private val ColorWhite = androidx.compose.ui.graphics.Color.White
