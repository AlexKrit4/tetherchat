package ru.tetherchat.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.ColorLens
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PersonOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.tetherchat.app.data.Perm
import ru.tetherchat.app.data.Role
import ru.tetherchat.app.data.ServerMember
import ru.tetherchat.app.data.can
import ru.tetherchat.app.data.toggle

private val Statuses = listOf(
  "online" to "В сети",
  "idle" to "Отошёл",
  "dnd" to "Не беспокоить",
  "invisible" to "Невидимый",
)

@Composable
fun SettingsScreen(model: AppViewModel) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    SettingsHeader("Настройки", model::back)
    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      SettingsRow(Icons.Outlined.Person, "Профиль", "Имя, аватар, статус") { model.openProfileSettings() }
      SettingsRow(Icons.Outlined.Lock, "Аккаунт", "Имя пользователя и почта") { model.openAccountSettings() }
      SettingsRow(Icons.Outlined.ColorLens, "Оформление", "Отправка по Enter") { model.openAppearanceSettings() }
      SettingsRow(Icons.Outlined.PersonOff, "Чёрный список", "Заблокированные пользователи") { model.openBlacklist() }
      Spacer(Modifier.height(12.dp))
      Button(
        onClick = model::logout,
        colors = ButtonDefaults.buttonColors(containerColor = Danger),
        modifier = Modifier.fillMaxWidth(),
      ) {
        Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null)
        Spacer(Modifier.padding(6.dp))
        Text("Выйти")
      }
    }
  }
}

@Composable
fun ProfileSettingsScreen(model: AppViewModel) {
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
    SettingsHeader("Профиль", model::back)
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
            color = if (selected) Color.White else TextMuted,
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
      Spacer(Modifier.height(24.dp))
    }
  }
}

@Composable
fun AccountSettingsScreen(model: AppViewModel) {
  val user = model.me ?: return
  var username by rememberSaveable(user.id) { mutableStateOf(user.username) }
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding()
      .imePadding(),
  ) {
    SettingsHeader("Аккаунт", model::back)
    Column(
      Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Field("Имя пользователя", username, 32) { username = it.lowercase() }
      Button(
        onClick = { model.saveUsername(username) },
        colors = ButtonDefaults.buttonColors(containerColor = Brand),
        modifier = Modifier.fillMaxWidth(),
      ) { Text("Сохранить имя") }
      Text("Email", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
      Text(user.email.ifBlank { "—" }, color = TextPrimary)
      Text(
        if (user.emailVerified) "Почта подтверждена" else "Почта не подтверждена",
        color = if (user.emailVerified) Online else TextMuted,
        fontSize = 13.sp,
      )
      TextButton(onClick = model::requestPasswordReset) {
        Text("Отправить ссылку сброса пароля", color = Brand)
      }
    }
  }
}

@Composable
fun AppearanceSettingsScreen(model: AppViewModel) {
  val user = model.me ?: return
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    SettingsHeader("Оформление", model::back)
    Row(
      Modifier.fillMaxWidth().padding(16.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(Modifier.weight(1f).padding(end = 12.dp)) {
        Text("Enter отправляет сообщение", color = TextPrimary, fontWeight = FontWeight.Medium)
        Text(
          "Если выключено, Enter делает новую строку, а отправка идёт кнопкой.",
          color = TextMuted,
          fontSize = 13.sp,
        )
      }
      Switch(checked = user.enterToSend, onCheckedChange = model::setEnterToSend)
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
    SettingsHeader("Чёрный список", model::back)
    if (model.blockedUsers.isEmpty()) {
      Text("Пока никого нет.", color = TextMuted, modifier = Modifier.padding(24.dp))
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
fun InviteLandingScreen(model: AppViewModel) {
  val preview = model.invitePreview
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .padding(24.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    SettingsHeader("Приглашение", model::back)
    if (preview == null && model.error == null) {
      Text("Загрузка…", color = TextMuted)
    } else if (preview == null) {
      Text(model.error ?: "Приглашение недействительно", color = Danger)
    } else {
      Text(preview.server.name, color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
      Text("${preview.server.memberCount} участников", color = TextMuted)
      Text("Пригласил @${preview.inviter.username}", color = TextMuted)
      if (preview.alreadyMember) {
        Text("Вы уже на этом сервере", color = Online)
        Button(onClick = { model.selectServer(preview.server.id); model.goHome() }) { Text("Открыть сервер") }
      } else if (model.me == null) {
        Button(onClick = model::continueInviteLogin, modifier = Modifier.fillMaxWidth()) {
          Text("Войти, чтобы присоединиться")
        }
      } else {
        Button(onClick = model::acceptInvite, modifier = Modifier.fillMaxWidth()) {
          Text("Присоединиться")
        }
      }
    }
    model.error?.let { Text(it, color = Danger) }
  }
}

@Composable
fun UserProfileScreen(model: AppViewModel) {
  val user = model.profileUser
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .padding(horizontal = 16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    SettingsHeader(user?.username ?: "Профиль", model::back)
    if (user == null) {
      Text("Загрузка…", color = TextMuted)
      return
    }
    UserAvatar(user, 72.dp, model.statusOf(user.id, user.status))
    Text(user.label, color = TextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Bold)
    Text("@${user.username}", color = TextMuted)
    user.bio?.takeIf { it.isNotBlank() }?.let { Text(it, color = TextPrimary) }
    Button(onClick = model::openDmFromProfile, modifier = Modifier.fillMaxWidth()) { Text("Написать") }
    if (user.id != model.me?.id) {
      Button(
        onClick = { model.blockUser(user.id) },
        colors = ButtonDefaults.buttonColors(containerColor = Danger),
        modifier = Modifier.fillMaxWidth(),
      ) { Text("Заблокировать") }
    }
  }
}

@Composable
fun MembersScreen(model: AppViewModel) {
  var q by remember { mutableStateOf("") }
  val members = model.members.filter {
    q.isBlank() || it.label.contains(q, true) || it.user.username.contains(q, true)
  }
  Column(
    Modifier.fillMaxSize().background(SurfaceDeep).statusBarsPadding(),
  ) {
    SettingsHeader("Участники", model::back)
    OutlinedTextField(
      q,
      { q = it },
      label = { Text("Поиск") },
      modifier = Modifier.fillMaxWidth().padding(12.dp),
      singleLine = true,
      colors = fieldColors(),
    )
    LazyColumn {
      items(members, key = { it.user.id }) { m ->
        Row(
          Modifier.fillMaxWidth().clickable { model.openProfile(m.user.id) }.padding(12.dp),
          verticalAlignment = Alignment.CenterVertically,
          horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
          UserAvatar(m.user, 36.dp, model.statusOf(m.user.id, m.user.status))
          Column(Modifier.weight(1f)) {
            Text(m.label, color = TextPrimary)
            Text("@${m.user.username}", color = TextMuted, fontSize = 12.sp)
          }
        }
      }
    }
  }
}

@Composable
fun ServerSettingsScreen(model: AppViewModel) {
  val server = model.serverDetail ?: return
  var tab by remember { mutableIntStateOf(0) }
  val tabs = listOf("Обзор", "Роли", "Участники", "Баны", "Приглашения")
  val pickIcon = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
    if (uri != null) model.uploadServerIcon(uri)
  }
  Column(Modifier.fillMaxSize().background(SurfaceDeep).statusBarsPadding()) {
    SettingsHeader(server.name, model::back)
    Row(
      Modifier
        .padding(horizontal = 8.dp)
        .horizontalScroll(rememberScrollState()),
      horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      tabs.forEachIndexed { i, t ->
        FilterChip(selected = tab == i, onClick = { tab = i }, label = { Text(t, fontSize = 12.sp) })
      }
    }
    when (tab) {
      0 -> OverviewTab(model, pickIcon::launch)
      1 -> RolesTab(model)
      2 -> MembersManageTab(model)
      3 -> BansTab(model)
      4 -> InvitesTab(model)
    }
  }
}

@Composable
private fun OverviewTab(model: AppViewModel, onPickIcon: (String) -> Unit) {
  val s = model.serverDetail ?: return
  var name by remember(s.id) { mutableStateOf(s.name) }
  var description by remember(s.id) { mutableStateOf(s.description.orEmpty()) }
  Column(
    Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    TextButton(onClick = { onPickIcon("image/*") }, enabled = model.canPerm(Perm.MANAGE_SERVER) || model.isOwner()) {
      Text("Сменить значок", color = Brand)
    }
    Field("Название", name, 100) { name = it }
    Field("Описание", description, 500, single = false) { description = it }
    Button(
      onClick = { model.saveServer(name, description) },
      enabled = model.canPerm(Perm.MANAGE_SERVER) || model.isOwner(),
      colors = ButtonDefaults.buttonColors(containerColor = Brand),
    ) { Text("Сохранить") }
    if (model.isOwner()) {
      Button(
        onClick = { model.deleteCurrentServer() },
        colors = ButtonDefaults.buttonColors(containerColor = Danger),
      ) { Text("Удалить сервер") }
    }
  }
}

@Composable
private fun RolesTab(model: AppViewModel) {
  var editing by remember { mutableStateOf<Role?>(null) }
  var name by remember { mutableStateOf("") }
  var color by remember { mutableStateOf("#5865F2") }
  var perms by remember { mutableIntStateOf(0) }
  var hoist by remember { mutableStateOf(false) }
  val canManage = model.canPerm(Perm.MANAGE_ROLES) || model.isOwner()
  Column(
    Modifier.verticalScroll(rememberScrollState()).padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    model.serverDetail?.roles.orEmpty().forEach { role ->
      Row(
        Modifier.fillMaxWidth().clickable(enabled = canManage) {
          editing = role
          name = role.name
          color = role.color ?: "#5865F2"
          perms = role.permissions
          hoist = role.hoist
        }.padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(role.name, color = parseHex(role.color), modifier = Modifier.weight(1f))
        if (canManage && !role.isDefault) {
          TextButton(onClick = { model.deleteRole(role) }) { Text("Удалить", color = Danger) }
        }
      }
    }
    if (canManage) {
      Text(if (editing == null) "Новая роль" else "Редактировать", color = TextMuted)
      Field("Имя", name, 64) { name = it }
      Field("Цвет #RRGGBB", color, 7) { color = it }
      Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { hoist = !hoist }) {
        Checkbox(checked = hoist, onCheckedChange = { hoist = it })
        Text("Показывать отдельно", color = TextPrimary)
      }
      Perm.ALL.forEach { (bit, label) ->
        Row(
          Modifier.fillMaxWidth().clickable { perms = perms.toggle(bit) },
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Checkbox(checked = perms.can(bit), onCheckedChange = { perms = perms.toggle(bit) })
          Text(label, color = TextPrimary, fontSize = 14.sp)
        }
      }
      Button(
        onClick = {
          val current = editing
          if (current == null) {
            model.createRole(name.ifBlank { "новая роль" })
          } else {
            model.saveRole(current, name, perms, hoist, color)
          }
          editing = null
          name = ""
          perms = 0
          hoist = false
        },
        colors = ButtonDefaults.buttonColors(containerColor = Brand),
      ) { Text(if (editing == null) "Создать" else "Сохранить") }
    }
  }
}

@Composable
private fun MembersManageTab(model: AppViewModel) {
  val roles = model.serverDetail?.roles.orEmpty()
  val canKick = model.canPerm(Perm.KICK_MEMBERS) || model.isOwner()
  val canBan = model.canPerm(Perm.BAN_MEMBERS) || model.isOwner()
  val canRoles = model.canPerm(Perm.MANAGE_ROLES) || model.isOwner()
  LazyColumn(Modifier.padding(12.dp)) {
    items(model.members, key = { it.user.id }) { m ->
      MemberManageRow(model, m, roles, canKick, canBan, canRoles)
    }
  }
}

@Composable
private fun MemberManageRow(
  model: AppViewModel,
  m: ServerMember,
  roles: List<Role>,
  canKick: Boolean,
  canBan: Boolean,
  canRoles: Boolean,
) {
  var expanded by remember { mutableStateOf(false) }
  Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
    Row(
      verticalAlignment = Alignment.CenterVertically,
      modifier = Modifier.clickable { expanded = !expanded }.fillMaxWidth(),
    ) {
      UserAvatar(m.user, 32.dp, model.statusOf(m.user.id, m.user.status))
      Text(m.label, color = TextPrimary, modifier = Modifier.weight(1f).padding(start = 8.dp))
    }
    if (expanded) {
      if (canRoles) {
        roles.filter { !it.isDefault }.forEach { role ->
          val has = m.roleIds.contains(role.id)
          Row(
            Modifier.clickable {
              val next = if (has) m.roleIds - role.id else m.roleIds + role.id
              model.setMemberRoles(m.user.id, next)
            },
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Checkbox(checked = has, onCheckedChange = null)
            Text(role.name, color = parseHex(role.color), fontSize = 13.sp)
          }
        }
      }
      Row {
        if (canKick && m.user.id != model.me?.id) {
          TextButton(onClick = { model.kick(m.user.id) }) { Text("Кик", color = Danger) }
        }
        if (canBan && m.user.id != model.me?.id) {
          TextButton(onClick = { model.ban(m.user.id) }) { Text("Бан", color = Danger) }
        }
      }
    }
  }
}

@Composable
private fun BansTab(model: AppViewModel) {
  LazyColumn(Modifier.padding(12.dp)) {
    items(model.bans, key = { it.userId }) { ban ->
      Row(Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(ban.user.label, color = TextPrimary, modifier = Modifier.weight(1f))
        if (model.canPerm(Perm.BAN_MEMBERS) || model.isOwner()) {
          TextButton(onClick = { model.unban(ban.userId) }) { Text("Разбанить") }
        }
      }
    }
    if (model.bans.isEmpty()) {
      item { Text("Банов нет", color = TextMuted, modifier = Modifier.padding(8.dp)) }
    }
  }
}

@Composable
private fun InvitesTab(model: AppViewModel) {
  val context = LocalContext.current
  Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    if (model.canPerm(Perm.CREATE_INVITE) || model.canPerm(Perm.MANAGE_SERVER) || model.isOwner()) {
      Button(onClick = { model.createInviteLink() }) { Text("Создать приглашение") }
    }
    model.invites.forEach { inv ->
      val url = model.copyInvite(inv.code)
      Text(
        "$url  ·  ${inv.uses} исп.",
        color = TextPrimary,
        fontSize = 13.sp,
        modifier = Modifier.clickable {
          context.getSystemService(ClipboardManager::class.java)
            ?.setPrimaryClip(ClipData.newPlainText("invite", url))
        },
      )
    }
  }
}

@Composable
private fun SettingsHeader(title: String, onBack: () -> Unit) {
  Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(end = 8.dp)) {
    IconButton(onClick = onBack) {
      Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад", tint = TextPrimary)
    }
    Text(title, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
  }
}

@Composable
private fun SettingsRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(SurfacePanel, RoundedCornerShape(12.dp))
      .clickable(onClick = onClick)
      .padding(16.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(icon, contentDescription = null, tint = TextMuted)
    Spacer(Modifier.padding(8.dp))
    Column(Modifier.weight(1f)) {
      Text(title, color = TextPrimary, fontWeight = FontWeight.Medium)
      Text(subtitle, color = TextMuted, fontSize = 12.sp)
    }
    Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = TextMuted)
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
    colors = fieldColors(),
  )
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
  focusedTextColor = TextPrimary,
  unfocusedTextColor = TextPrimary,
  focusedContainerColor = SurfacePanel,
  unfocusedContainerColor = SurfacePanel,
  focusedBorderColor = Brand,
  unfocusedBorderColor = SurfaceRaised,
  cursorColor = Brand,
  focusedLabelColor = TextMuted,
  unfocusedLabelColor = TextMuted,
)

private fun parseHex(hex: String?): Color = try {
  Color(android.graphics.Color.parseColor(if (hex.isNullOrBlank()) "#5865F2" else if (hex.startsWith("#")) hex else "#$hex"))
} catch (_: Exception) {
  Brand
}
