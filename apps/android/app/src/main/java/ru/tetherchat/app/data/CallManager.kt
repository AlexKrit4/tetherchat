package ru.tetherchat.app.data

import android.app.Application
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import io.livekit.android.LiveKit
import io.livekit.android.room.Room
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CallManager(private val app: Application) {
  private val audioManager = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private var room: Room? = null
  private var previousMode: Int? = null
  private var previousSpeaker: Boolean? = null
  private var audioFocusRequest: AudioFocusRequest? = null

  suspend fun connect(url: String, token: String) {
    withContext(Dispatchers.Main) {
      disconnect()
      startAudioSession()
      val next = LiveKit.create(app)
      room = next
      next.connect(url, token)
      next.localParticipant.setMicrophoneEnabled(true)
      audioManager.isSpeakerphoneOn = true
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
    stopAudioSession()
  }

  private fun startAudioSession() {
    previousMode = audioManager.mode
    previousSpeaker = audioManager.isSpeakerphoneOn
    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
    audioManager.isSpeakerphoneOn = true

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val focusRequest =
        AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
              .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
              .build(),
          )
          .build()
      audioFocusRequest = focusRequest
      audioManager.requestAudioFocus(focusRequest)
    } else {
      @Suppress("DEPRECATION")
      audioManager.requestAudioFocus(
        null,
        AudioManager.STREAM_VOICE_CALL,
        AudioManager.AUDIOFOCUS_GAIN_TRANSIENT,
      )
    }
  }

  private fun stopAudioSession() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
      audioFocusRequest = null
    } else {
      @Suppress("DEPRECATION")
      audioManager.abandonAudioFocus(null)
    }
    audioManager.mode = previousMode ?: AudioManager.MODE_NORMAL
    audioManager.isSpeakerphoneOn = previousSpeaker ?: false
    previousMode = null
    previousSpeaker = null
  }
}
