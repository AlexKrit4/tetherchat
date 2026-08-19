package ru.tetherchat.app

import android.app.Application
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner

class TetherChatApp : Application() {
  override fun onCreate() {
    super.onCreate()
    NotificationHelper.ensureChannels(this)
    PushRegistrar.init(this)
    ProcessLifecycleOwner.get().lifecycle.addObserver(
      object : DefaultLifecycleObserver {
        override fun onStart(owner: LifecycleOwner) {
          ForegroundState.inForeground = true
          PushRegistrar.sync(this@TetherChatApp)
        }

        override fun onStop(owner: LifecycleOwner) {
          ForegroundState.inForeground = false
        }
      },
    )
  }
}

object ForegroundState {
  @Volatile var inForeground: Boolean = false
}
