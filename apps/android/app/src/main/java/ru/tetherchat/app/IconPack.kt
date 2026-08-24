package ru.tetherchat.app

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat

data class LauncherAlias(val id: String, val label: String)

object IconPack {
  val ALIASES = listOf(
    LauncherAlias("LauncherDefault", "Тёмная"),
    LauncherAlias("LauncherLight", "Светлая"),
    LauncherAlias("LauncherBrand", "Фиолетовая"),
    LauncherAlias("LauncherGreen", "Зелёная"),
    LauncherAlias("LauncherGold", "Золотая"),
    LauncherAlias("LauncherRed", "Красная"),
    LauncherAlias("LauncherMono", "Моно"),
  )

  fun setAlias(context: Context, aliasId: String) {
    val pm = context.packageManager
    ALIASES.forEach { alias ->
      val component = ComponentName(context, "${context.packageName}.${alias.id}")
      val state =
        if (alias.id == aliasId) PackageManager.COMPONENT_ENABLED_STATE_ENABLED
        else PackageManager.COMPONENT_ENABLED_STATE_DISABLED
      pm.setComponentEnabledSetting(component, state, PackageManager.DONT_KILL_APP)
    }
  }

  fun createGalleryShortcut(context: Context, uri: Uri) {
    val bitmap = bitmapFrom(context, uri) ?: return
    val shortcut = ShortcutInfoCompat.Builder(context, "tetherchat.custom-icon")
      .setShortLabel("TetherChat")
      .setLongLabel("TetherChat")
      .setIcon(IconCompat.createWithBitmap(bitmap))
      .setIntent(
        Intent(context, MainActivity::class.java).setAction(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),
      )
      .build()
    ShortcutManagerCompat.requestPinShortcut(context, shortcut, null)
  }

  @Suppress("DEPRECATION")
  private fun bitmapFrom(context: Context, uri: Uri): Bitmap? {
    return runCatching {
      if (Build.VERSION.SDK_INT >= 28) {
        ImageDecoder.decodeBitmap(ImageDecoder.createSource(context.contentResolver, uri))
      } else {
        MediaStore.Images.Media.getBitmap(context.contentResolver, uri)
      }
    }.getOrNull()
  }
}
