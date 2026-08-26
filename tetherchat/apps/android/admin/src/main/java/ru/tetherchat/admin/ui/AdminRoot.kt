package ru.tetherchat.admin.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.material.icons.outlined.Gavel
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Report
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import ru.tetherchat.admin.data.MessageReport
import ru.tetherchat.admin.data.SiteBan

@Composable
fun AdminRoot(model: AdminViewModel) {
  val canBack = model.screen !is Screen.Login && model.screen !is Screen.Home
  BackHandler(enabled = canBack) { model.back() }
  when (val screen = model.screen) {
    Screen.Login -> LoginPane(model)
    Screen.Home -> HomePane(model)
    Screen.ActiveReports -> ReportListPane(model, "Действующие репорты", pending = true)
    Screen.History -> ReportListPane(model, "История репортов", pending = false)
    Screen.Bans -> BanListPane(model)
    is Screen.Report -> ReportDetailPane(model)
    is Screen.Ban -> BanDetailPane(model)
  }
}

@Composable
private fun LoginPane(model: AdminViewModel) {
  var login by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .imePadding()
      .padding(24.dp),
    verticalArrangement = Arrangement.Center,
  ) {
    Text("TetherChat", color = Brand, fontWeight = FontWeight.Bold, fontSize = 20.sp)
    Text("Панель администратора", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 26.sp)
    Text("Вставьте логин и пароль из основного приложения", color = TextMuted, fontSize = 14.sp)
    Spacer(Modifier.height(20.dp))
    Field("Логин", login) { login = it }
    Spacer(Modifier.height(10.dp))
    Field("Пароль", password, password = true) { password = it }
    if (!model.error.isNullOrBlank()) {
      Spacer(Modifier.height(8.dp))
      Text(model.error.orEmpty(), color = Danger, fontSize = 14.sp)
    }
    Spacer(Modifier.height(16.dp))
    Button(
      onClick = { model.login(login, password) },
      enabled = !model.busy && login.isNotBlank() && password.isNotBlank(),
      colors = ButtonDefaults.buttonColors(containerColor = Brand),
      modifier = Modifier.fillMaxWidth().height(48.dp),
      shape = RoundedCornerShape(8.dp),
    ) { Text(if (model.busy) "…" else "Войти") }
  }
}

@Composable
private fun HomePane(model: AdminViewModel) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding()
      .padding(16.dp),
  ) {
    Text("Админ-панель", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 24.sp)
    Text("Сессия сгорает в 00:00 по Москве", color = TextMuted, fontSize = 13.sp)
    Spacer(Modifier.height(20.dp))
    MenuCard(Icons.Outlined.Report, "Действующие репорты", "Жалобы без решения") { model.openActive() }
    Spacer(Modifier.height(10.dp))
    MenuCard(Icons.Outlined.History, "История репортов", "Закрытые жалобы") { model.openHistory() }
    Spacer(Modifier.height(10.dp))
    MenuCard(Icons.Outlined.Gavel, "Забаненные пользователи", "Активные баны") { model.openBans() }
    Spacer(Modifier.weight(1f))
    Button(
      onClick = model::logout,
      colors = ButtonDefaults.buttonColors(containerColor = Danger),
      modifier = Modifier.fillMaxWidth(),
    ) { Text("Выйти") }
  }
}

@Composable
private fun MenuCard(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .clip(RoundedCornerShape(12.dp))
      .background(SurfacePanel)
      .clickable(onClick = onClick)
      .padding(16.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    Icon(icon, contentDescription = null, tint = Brand)
    Column {
      Text(title, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
      Text(subtitle, color = TextMuted, fontSize = 13.sp)
    }
  }
}

@Composable
private fun ReportListPane(model: AdminViewModel, title: String, pending: Boolean) {
  Column(
    Modifier.fillMaxSize().background(SurfaceDeep).statusBarsPadding().navigationBarsPadding(),
  ) {
    Header(title, model::back)
    if (!model.error.isNullOrBlank()) {
      Text(model.error.orEmpty(), color = Danger, modifier = Modifier.padding(16.dp))
    }
    if (model.reports.isEmpty()) {
      Text("Список пуст", color = TextMuted, modifier = Modifier.padding(24.dp))
    } else {
      LazyColumn {
        items(model.reports, key = { it.id }) { report ->
          Column(
            Modifier
              .fillMaxWidth()
              .clickable { model.openReport(report.id) }
              .padding(horizontal = 16.dp, vertical = 12.dp),
          ) {
            Text(report.target.label, color = TextPrimary, fontWeight = FontWeight.Medium)
            Text(
              "от ${report.reporter.label} · ${report.statusLabel()}",
              color = TextMuted,
              fontSize = 12.sp,
            )
            Text(
              report.messageContent.ifBlank { "Вложение" },
              color = TextMuted,
              fontSize = 13.sp,
              maxLines = 2,
            )
          }
        }
      }
    }
  }
}

@Composable
private fun ReportDetailPane(model: AdminViewModel) {
  val report = model.currentReport
  var banOpen by remember { mutableStateOf(false) }
  Column(
    Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    Header("Репорт", model::back)
    if (report == null) {
      Text("Загрузка…", color = TextMuted, modifier = Modifier.padding(16.dp))
      return
    }
    Column(
      Modifier
        .weight(1f)
        .verticalScroll(rememberScrollState())
        .padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Text("Сообщение", color = TextMuted, fontSize = 12.sp)
      Text(report.target.label, color = TextPrimary, fontWeight = FontWeight.SemiBold)
      Text(report.messageContent.ifBlank { "Без текста" }, color = TextPrimary)
      report.attachments.forEach { attachment ->
        if (attachment.contentType.startsWith("image/") && attachment.url.isNotBlank()) {
          AsyncImage(
            model = attachment.url,
            contentDescription = attachment.filename,
            modifier = Modifier.fillMaxWidth().heightIn(max = 280.dp).clip(RoundedCornerShape(8.dp)),
            contentScale = ContentScale.Fit,
          )
        } else {
          Text(attachment.filename, color = Brand)
        }
      }
      Text("Комментарий жалобы", color = TextMuted, fontSize = 12.sp)
      Text("От ${report.reporter.label}", color = TextMuted, fontSize = 12.sp)
      Text(report.comment, color = TextPrimary)
      if (report.status != "pending") {
        Text(
          when (report.status) {
            "pardoned" -> "Решение: помилован"
            "banned" -> "Решение: бан${report.ban?.reason?.let { " — $it" } ?: ""}"
            else -> report.status
          },
          color = TextMuted,
        )
      }
    }
    if (report.status == "pending") {
      Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Button(
          onClick = model::pardon,
          enabled = !model.busy,
          colors = ButtonDefaults.buttonColors(containerColor = Online),
          modifier = Modifier.weight(1f),
        ) { Text("Помиловать") }
        Button(
          onClick = { banOpen = true },
          enabled = !model.busy,
          colors = ButtonDefaults.buttonColors(containerColor = Danger),
          modifier = Modifier.weight(1f),
        ) { Text("Забанить") }
      }
    }
  }
  if (banOpen) {
    BanDialog(
      onDismiss = { banOpen = false },
      onConfirm = { hours, message ->
        banOpen = false
        model.ban(hours, message)
      },
    )
  }
}

@Composable
private fun BanDialog(onDismiss: () -> Unit, onConfirm: (Int?, String) -> Unit) {
  var hours by remember { mutableStateOf("24") }
  var message by remember { mutableStateOf("Ваш аккаунт заблокирован за нарушение правил.") }
  var permanent by remember { mutableStateOf(false) }
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("Забанить пользователя") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Field("Часов бана", hours) { hours = it.filter { ch -> ch.isDigit() }.take(5) }
        TextButton(onClick = { permanent = !permanent }) {
          Text(if (permanent) "Срок: навсегда" else "Сделать перманентным")
        }
        Field("Сообщение при входе", message) { message = it }
      }
    },
    confirmButton = {
      TextButton(
        onClick = { onConfirm(if (permanent) null else hours.toIntOrNull() ?: 24, message.trim()) },
        enabled = message.trim().isNotEmpty(),
      ) { Text("Забанить", color = Danger) }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
  )
}

@Composable
private fun BanListPane(model: AdminViewModel) {
  Column(Modifier.fillMaxSize().background(SurfaceDeep).statusBarsPadding().navigationBarsPadding()) {
    Header("Забаненные пользователи", model::back)
    if (model.bans.isEmpty()) {
      Text("Никто не забанен", color = TextMuted, modifier = Modifier.padding(24.dp))
    } else {
      LazyColumn {
        items(model.bans, key = { it.id }) { ban ->
          Column(
            Modifier.fillMaxWidth().clickable { model.openBan(ban) }.padding(16.dp),
          ) {
            Text(ban.user.label, color = TextPrimary, fontWeight = FontWeight.Medium)
            Text(ban.reason, color = TextMuted, fontSize = 13.sp, maxLines = 2)
            Text(
              if (ban.expiresAt == null) "Навсегда" else "До ${ban.expiresAt.take(16).replace('T', ' ')}",
              color = TextMuted,
              fontSize = 12.sp,
            )
          }
        }
      }
    }
  }
}

@Composable
private fun BanDetailPane(model: AdminViewModel) {
  val ban = model.currentBan
  Column(Modifier.fillMaxSize().background(SurfaceDeep).statusBarsPadding().navigationBarsPadding()) {
    Header("Бан", model::back)
    if (ban == null) return
    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(ban.user.label, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 20.sp)
      Text("@${ban.user.username}", color = TextMuted)
      Text("Причина", color = TextMuted, fontSize = 12.sp)
      Text(ban.reason, color = TextPrimary)
      Text(
        if (ban.expiresAt == null) "Срок: навсегда" else "До ${ban.expiresAt.replace('T', ' ').take(19)}",
        color = TextMuted,
      )
      Spacer(Modifier.height(12.dp))
      Button(
        onClick = model::liftBan,
        enabled = !model.busy,
        colors = ButtonDefaults.buttonColors(containerColor = Brand),
        modifier = Modifier.fillMaxWidth(),
      ) { Text("Разжаловать") }
    }
  }
}

@Composable
private fun Header(title: String, onBack: () -> Unit) {
  Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(end = 8.dp)) {
    IconButton(onClick = onBack) {
      Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад", tint = TextPrimary)
    }
    Text(title, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
  }
}

@Composable
private fun Field(label: String, value: String, password: Boolean = false, onChange: (String) -> Unit) {
  OutlinedTextField(
    value = value,
    onValueChange = onChange,
    label = { Text(label) },
    singleLine = true,
    visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
    modifier = Modifier.fillMaxWidth(),
    colors = OutlinedTextFieldDefaults.colors(
      focusedTextColor = TextPrimary,
      unfocusedTextColor = TextPrimary,
      focusedBorderColor = Brand,
      unfocusedBorderColor = TextMuted,
      cursorColor = Brand,
    ),
  )
}

private fun MessageReport.statusLabel(): String = when (status) {
  "pending" -> "ожидает"
  "pardoned" -> "помилован"
  "banned" -> "бан"
  else -> status
}
