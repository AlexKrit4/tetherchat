package ru.tetherchat.app

import android.os.Handler
import android.os.Looper

/**
 * Notification actions target the currently running in-process LiveKit call.
 * If the process no longer owns a call, the receiver falls back to the API.
 */
object CallActionBus {
  @Volatile private var muteHandler: (() -> Unit)? = null
  @Volatile private var hangupHandler: (() -> Unit)? = null

  fun register(onMute: () -> Unit, onHangup: () -> Unit) {
    muteHandler = onMute
    hangupHandler = onHangup
  }

  fun clear() {
    muteHandler = null
    hangupHandler = null
  }

  fun mute(): Boolean = dispatch(muteHandler)

  fun hangup(): Boolean = dispatch(hangupHandler)

  private fun dispatch(handler: (() -> Unit)?): Boolean {
    handler ?: return false
    Handler(Looper.getMainLooper()).post(handler)
    return true
  }
}
