package ru.tetherchat.app.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Android
import androidx.compose.material.icons.outlined.Computer
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun InstallScreen(model: AppViewModel) {
  val context = LocalContext.current
  LaunchedEffect(Unit) { model.loadInstallDownloads() }
  val data = model.installDownloads

  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    SettingsHeader("Установить", model::back)
    Column(
      modifier = Modifier
        .weight(1f)
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 16.dp, vertical = 8.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Text(
        "Скачайте TetherChat на телефон, Windows или Linux.",
        color = TextMuted,
        fontSize = 14.sp,
      )
      if (data == null) {
        Text("Загрузка…", color = TextMuted)
        return@Column
      }
      InstallPlatformCard(
        title = "Android (APK)",
        version = data.android.versionName,
        hint = "Установите APK на телефон. Если обновление не ставится поверх старой версии — удалите приложение и установите заново.",
        onDownload = {
          context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(data.android.url)))
        },
        icon = Icons.Outlined.Android,
      )
      InstallPlatformCard(
        title = "Windows",
        version = data.windows.versionName,
        hint = "Установщик .exe для Windows 10/11. Это отдельная программа, не браузер.",
        onDownload = {
          context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(data.windows.url)))
        },
        icon = Icons.Outlined.Computer,
      )
      InstallPlatformCard(
        title = "Linux (AppImage)",
        version = data.linuxAppImage.versionName,
        hint = "Универсальный AppImage — скачайте, сделайте исполняемым и запустите.",
        onDownload = {
          context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(data.linuxAppImage.url)))
        },
        icon = Icons.Outlined.Computer,
      )
      InstallPlatformCard(
        title = "Linux (deb)",
        version = data.linuxDeb.versionName,
        hint = "Пакет .deb для Ubuntu/Debian: sudo dpkg -i TetherChat.deb",
        onDownload = {
          context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(data.linuxDeb.url)))
        },
        icon = Icons.Outlined.Computer,
      )
    }
  }
}

@Composable
private fun InstallPlatformCard(
  title: String,
  version: String,
  hint: String,
  onDownload: () -> Unit,
  icon: androidx.compose.ui.graphics.vector.ImageVector,
) {
  Column(
    modifier = Modifier
      .fillMaxWidth()
      .background(SurfacePanel, RoundedCornerShape(12.dp))
      .padding(16.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Icon(icon, contentDescription = null, tint = Brand)
      Column {
        Text(title, color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Text("v$version", color = TextMuted, fontSize = 12.sp)
      }
    }
    Text(hint, color = TextMuted, fontSize = 13.sp, lineHeight = 18.sp)
    Button(
      onClick = onDownload,
      colors = ButtonDefaults.buttonColors(containerColor = Brand),
      modifier = Modifier.fillMaxWidth(),
    ) {
      Icon(Icons.Outlined.Download, contentDescription = null)
      Text("Скачать", modifier = Modifier.padding(start = 8.dp))
    }
  }
}
