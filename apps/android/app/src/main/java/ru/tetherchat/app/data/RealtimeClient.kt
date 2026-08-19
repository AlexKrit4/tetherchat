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
    onMessageUpdated: (Message) -> Unit,
    onMessageDeleted: (MessageDeletedEvent) -> Unit,
    onReaction: (ReactionUpdatedEvent) -> Unit,
    onDmCreate: (DirectConversation) -> Unit,
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
      decode<Message>(args)?.let(onMessage)
    }
    next.on("message:updated") { args ->
      decode<Message>(args)?.let(onMessageUpdated)
    }
    next.on("message:deleted") { args ->
      decode<MessageDeletedEvent>(args)?.let(onMessageDeleted)
    }
    next.on("reaction:updated") { args ->
      decode<ReactionUpdatedEvent>(args)?.let(onReaction)
    }
    next.on("dm:create") { args ->
      decode<DirectConversation>(args)?.let(onDmCreate)
    }
    next.on("presence:update") { args ->
      decode<PresenceEvent>(args)?.let(onPresence)
    }
    next.on(Socket.EVENT_CONNECT) { onReady() }
    next.connect()
    socket = next
  }

  private inline fun <reified T> decode(args: Array<Any>): T? {
    val raw = args.firstOrNull() as? JSONObject ?: return null
    return runCatching { json.decodeFromString<T>(raw.toString()) }.getOrNull()
  }

  fun connected(): Boolean = socket?.connected() == true

  fun disconnect() {
    socket?.off()
    socket?.disconnect()
    socket = null
  }
}
