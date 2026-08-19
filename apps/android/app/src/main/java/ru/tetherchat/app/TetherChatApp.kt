package ru.tetherchat.app

import android.app.Application
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import ru.tetherchat.app.data.SessionStore

class TetherChatApp : Application() {
  override fun onCreate() {
    super.onCreate()
    NotificationHelper.ensureChannels(this)
    ProcessLifecycleOwner.get().lifecycle.addObserver(
      object : DefaultLifecycleObserver {
        override fun onStart(owner: LifecycleOwner) {
          ForegroundState.inForeground = true
          stopService(Intent(this@TetherChatApp, MessagePushService::class.java))
        }

        override fun onStop(owner: LifecycleOwner) {
          ForegroundState.inForeground = false
          if (SessionStore.get(this@TetherChatApp).hasSession) {
            ContextCompat.startForegroundService(
              this@TetherChatApp,
              Intent(this@TetherChatApp, MessagePushService::class.java),
            )
          }
        }
      },
    )
  }
}

object ForegroundState {
  @Volatile var inForeground: Boolean = false
}
