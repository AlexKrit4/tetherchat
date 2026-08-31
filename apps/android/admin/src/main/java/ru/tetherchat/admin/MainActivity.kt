package ru.tetherchat.admin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import ru.tetherchat.admin.ui.AdminRoot
import ru.tetherchat.admin.ui.AdminTheme
import ru.tetherchat.admin.ui.AdminViewModel

class MainActivity : ComponentActivity() {
  private val model by viewModels<AdminViewModel>()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent { AdminTheme { AdminRoot(model) } }
  }
}
