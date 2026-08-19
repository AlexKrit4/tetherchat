package ru.tetherchat.app.data

import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import ru.tetherchat.app.BuildConfig
import java.net.URI

class RealtimeClient(
  private val api: TetherApi,
  private val json: kotlinx.serialization.json.Json,
) {
  private var socket: Socket? = null

  fun connect(
    onMessage: (Message) -> Unit,
    onPresence: (PresenceEvent) -> Unit,
    onReady: () -> Unit,
  ) {
    disconnect()
    val token = api.ensureAccessToken()
    val options = IO.Options().apply {
      path = "/socket.io"
      transports = arrayOf("websocket")
      forceNew = true
      reconnection = true
      reconnectionDelay = 500
      reconnectionDelayMax = 8_000
      auth = hashMapOf("token" to token)
    }
    val next = IO.socket(URI.create(BuildConfig.API_URL), options)
    next.on("message:new") { args ->
      val raw = args.firstOrNull() as? JSONObject ?: return@on
      runCatching { json.decodeFromString<Message>(raw.toString()) }.getOrNull()?.let(onMessage)
    }
    next.on("presence:update") { args ->
      val raw = args.firstOrNull() as? JSONObject ?: return@on
      runCatching { json.decodeFromString<PresenceEvent>(raw.toString()) }.getOrNull()?.let(onPresence)
    }
    next.on(Socket.EVENT_CONNECT) { onReady() }
    next.connect()
    socket = next
  }

  fun connected(): Boolean = socket?.connected() == true

  fun disconnect() {
    socket?.off()
    socket?.disconnect()
    socket = null
  }
}
