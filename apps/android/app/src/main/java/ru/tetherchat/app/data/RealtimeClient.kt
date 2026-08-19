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
  var onConnection: ((Boolean) -> Unit)? = null

  fun connect(handlers: RealtimeHandlers) {
    if (connected()) return
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
    next.on("message:new") { args -> decode<Message>(args)?.let(handlers.onMessage) }
    next.on("message:updated") { args -> decode<Message>(args)?.let(handlers.onMessageUpdated) }
    next.on("message:deleted") { args -> decode<MessageDeletedEvent>(args)?.let(handlers.onMessageDeleted) }
    next.on("reaction:updated") { args -> decode<ReactionUpdatedEvent>(args)?.let(handlers.onReaction) }
    next.on("dm:create") { args -> decode<DirectConversation>(args)?.let(handlers.onDmCreate) }
    next.on("dm:update") { args -> decode<DirectConversation>(args)?.let(handlers.onDmUpdate) }
    next.on("friend:incoming") { args -> decode<FriendIncomingEvent>(args)?.let(handlers.onFriendIncoming) }
    next.on("friend:accepted") { args -> decode<FriendAcceptedEvent>(args)?.let(handlers.onFriendAccepted) }
    next.on("receipt:update") { args -> decode<ReceiptUpdate>(args)?.let(handlers.onReceipt) }
    next.on("presence:update") { args -> decode<PresenceEvent>(args)?.let(handlers.onPresence) }
    next.on("typing:update") { args -> decode<TypingEvent>(args)?.let(handlers.onTyping) }
    next.on("member:join") { args -> handlers.onServerChanged() }
    next.on("member:leave") { args -> handlers.onServerChanged() }
    next.on("member:update") { args -> handlers.onServerChanged() }
    next.on("channel:create") { args -> handlers.onServerChanged() }
    next.on("channel:update") { args -> handlers.onServerChanged() }
    next.on("channel:delete") { args -> handlers.onServerChanged() }
    next.on("category:create") { args -> handlers.onServerChanged() }
    next.on("category:update") { args -> handlers.onServerChanged() }
    next.on("category:delete") { args -> handlers.onServerChanged() }
    next.on("role:update") { args -> handlers.onServerChanged() }
    next.on("server:update") { args -> handlers.onServersChanged() }
    next.on("server:delete") { args -> handlers.onServersChanged() }
    next.on("server:join") { args -> handlers.onServersChanged() }
    next.on(Socket.EVENT_CONNECT) {
      onConnection?.invoke(true)
      handlers.onReady()
    }
    next.on(Socket.EVENT_DISCONNECT) { onConnection?.invoke(false) }
    next.connect()
    socket = next
  }

  fun subscribe(channelId: String) {
    emit("channel:subscribe", JSONObject().put("channelId", channelId))
  }

  fun unsubscribe(channelId: String) {
    emit("channel:unsubscribe", JSONObject().put("channelId", channelId))
  }

  fun typingStart(channelId: String) {
    emit("typing:start", JSONObject().put("channelId", channelId))
  }

  fun typingStop(channelId: String) {
    emit("typing:stop", JSONObject().put("channelId", channelId))
  }

  private fun emit(event: String, payload: JSONObject) {
    socket?.emit(event, payload)
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

class RealtimeHandlers(
  val onMessage: (Message) -> Unit,
  val onMessageUpdated: (Message) -> Unit,
  val onMessageDeleted: (MessageDeletedEvent) -> Unit,
  val onReaction: (ReactionUpdatedEvent) -> Unit,
  val onDmCreate: (DirectConversation) -> Unit,
  val onDmUpdate: (DirectConversation) -> Unit,
  val onFriendIncoming: (FriendIncomingEvent) -> Unit,
  val onFriendAccepted: (FriendAcceptedEvent) -> Unit,
  val onReceipt: (ReceiptUpdate) -> Unit,
  val onPresence: (PresenceEvent) -> Unit,
  val onTyping: (TypingEvent) -> Unit,
  val onServerChanged: () -> Unit,
  val onServersChanged: () -> Unit,
  val onReady: () -> Unit,
)
