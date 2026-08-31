package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.tetherchat.app.BuildConfig
import ru.tetherchat.app.data.VersionHistoryEntry
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val releaseDateFormatter = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale("ru"))

private fun formatReleaseDate(raw: String): String = runCatching {
  LocalDate.parse(raw.take(10)).format(releaseDateFormatter)
}.getOrElse { raw.take(10) }

@Composable
fun AboutAppScreen(model: AppViewModel) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    SettingsHeader("О приложении", model::back)
    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Column(
        modifier = Modifier
          .fillMaxWidth()
          .background(SurfacePanel, RoundedCornerShape(16.dp))
          .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        Text("TetherChat", color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 24.sp)
        Text("Версия ${BuildConfig.VERSION_NAME}", color = TextPrimary, fontSize = 16.sp)
        Text("Сборка ${BuildConfig.VERSION_CODE}", color = TextMuted, fontSize = 13.sp)
      }

      AboutInfoRow(Icons.Outlined.Person, "Создатель", model.appCreator)

      SettingsRow(Icons.Outlined.History, "История версий", "Что нового в каждом обновлении") {
        model.openVersionHistory()
      }
    }
  }
}

@Composable
fun VersionHistoryScreen(model: AppViewModel) {
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    SettingsHeader("История версий", model::back)
    if (model.versionHistory.isEmpty()) {
      Text("Загрузка…", color = TextMuted, modifier = Modifier.padding(16.dp))
      return
    }
    LazyColumn(
      modifier = Modifier.padding(horizontal = 16.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      items(model.versionHistory, key = { it.versionCode }) { entry ->
        val current = entry.versionCode == BuildConfig.VERSION_CODE
        VersionHistoryRow(entry, current) { model.openVersionDetail(entry) }
      }
    }
  }
}

@Composable
fun VersionDetailScreen(model: AppViewModel, entry: VersionHistoryEntry) {
  val current = entry.versionCode == BuildConfig.VERSION_CODE
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    SettingsHeader("Версия ${entry.versionName}", model::back)
    Column(
      modifier = Modifier
        .padding(horizontal = 16.dp)
        .fillMaxWidth()
        .background(SurfacePanel, RoundedCornerShape(16.dp))
        .padding(20.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Text(
        if (current) "Текущая версия" else "Версия ${entry.versionName}",
        color = TextPrimary,
        fontWeight = FontWeight.SemiBold,
        fontSize = 18.sp,
      )
      if (entry.releasedAt.isNotBlank()) {
        Text(formatReleaseDate(entry.releasedAt), color = TextMuted, fontSize = 13.sp)
      }
      if (entry.requiresReinstall) {
        Text("Требовалась переустановка приложения", color = Danger, fontSize = 13.sp)
      }
      Spacer(Modifier.height(4.dp))
      Text("Что нового", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Medium)
      Text(
        entry.releaseNotes.ifBlank { "Нет описания для этой версии." },
        color = TextPrimary,
        fontSize = 15.sp,
        lineHeight = 22.sp,
      )
    }
  }
}

@Composable
private fun AboutInfoRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, value: String) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(SurfacePanel, RoundedCornerShape(12.dp))
      .padding(horizontal = 14.dp, vertical = 14.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Icon(icon, contentDescription = null, tint = Brand)
    Column(Modifier.weight(1f)) {
      Text(label, color = TextMuted, fontSize = 12.sp)
      Text(value, color = TextPrimary, fontWeight = FontWeight.Medium, fontSize = 15.sp)
    }
  }
}

@Composable
private fun VersionHistoryRow(entry: VersionHistoryEntry, current: Boolean, onClick: () -> Unit) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(SurfacePanel, RoundedCornerShape(12.dp))
      .clickable(onClick = onClick)
      .padding(horizontal = 14.dp, vertical = 14.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Column(Modifier.weight(1f)) {
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(entry.versionName, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        if (current) {
          Text(
            "текущая",
            color = Brand,
            fontSize = 11.sp,
            modifier = Modifier
              .background(Brand.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
              .padding(horizontal = 6.dp, vertical = 2.dp),
          )
        }
      }
      if (entry.releasedAt.isNotBlank()) {
        Text(formatReleaseDate(entry.releasedAt), color = TextMuted, fontSize = 12.sp)
      }
    }
    Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = TextMuted)
  }
}

@Composable
private fun SettingsRow(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  title: String,
  subtitle: String,
  onClick: () -> Unit,
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(SurfacePanel, RoundedCornerShape(12.dp))
      .clickable(onClick = onClick)
      .padding(horizontal = 14.dp, vertical = 14.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Icon(icon, contentDescription = null, tint = Brand, modifier = Modifier.padding(end = 12.dp))
    Column(Modifier.weight(1f)) {
      Text(title, color = TextPrimary, fontWeight = FontWeight.Medium, fontSize = 15.sp)
      Text(subtitle, color = TextMuted, fontSize = 12.sp)
    }
    Icon(Icons.Outlined.ChevronRight, contentDescription = null, tint = TextMuted)
  }
}
