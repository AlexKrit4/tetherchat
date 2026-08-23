package ru.tetherchat.app.data

import android.app.Application
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CallManager(private val app: Application) {
  private var room: Room? = null

  suspend fun connect(url: String, token: String) {
    withContext(Dispatchers.Main) {
      disconnect()
      val next = LiveKit.create(app)
      room = next
      next.connect(url, token)
      next.localParticipant.setMicrophoneEnabled(true)
    }
  }

  suspend fun setMuted(muted: Boolean) {
    withContext(Dispatchers.Main) {
      room?.localParticipant?.setMicrophoneEnabled(!muted)
    }
  }

  fun disconnect() {
    room?.disconnect()
    room = null
  }
}
