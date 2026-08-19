package ru.tetherchat.app.ui

import android.app.Application
import android.content.ContentResolver
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.tetherchat.app.data.ApiException
import ru.tetherchat.app.data.Channel
import ru.tetherchat.app.data.DirectConversation
import ru.tetherchat.app.data.Message
import ru.tetherchat.app.data.PendingUpload
import ru.tetherchat.app.data.PublicUser
import ru.tetherchat.app.data.RealtimeClient
import ru.tetherchat.app.data.SelfUser
import ru.tetherchat.app.data.ServerDetail
import ru.tetherchat.app.data.ServerMember
import ru.tetherchat.app.data.ServerSummary
import ru.tetherchat.app.data.SessionStore
import ru.tetherchat.app.data.TetherApi
import java.util.UUID

sealed class Screen {
  data object Boot : Screen()
  data object Login : Screen()
  data object Register : Screen()
  data object Home : Screen()
  data object Settings : Screen()
  data object Blacklist : Screen()
  data class Chat(
    val channelId: String,
    val serverId: String?,
    val title: String,
    val dm: Boolean,
  ) : Screen()
}

class AppViewModel(application: Application) : AndroidViewModel(application), DefaultLifecycleObserver {
  private val session = SessionStore.get(application)
  private val api = TetherApi(session)
  private val realtime = RealtimeClient(api, api.json)

  var screen by mutableStateOf<Screen>(Screen.Boot)
    private set
  var me by mutableStateOf<SelfUser?>(null)
    private set
  var error by mutableStateOf<String?>(null)
  var busy by mutableStateOf(false)
    private set

  var servers by mutableStateOf<List<ServerSummary>>(emptyList())
    private set
  var dms by mutableStateOf<List<DirectConversation>>(emptyList())
    private set
  var selectedServerId by mutableStateOf<String?>(null)
  var serverDetail by mutableStateOf<ServerDetail?>(null)
    private set
  var members by mutableStateOf<List<ServerMember>>(emptyList())
    private set
  val presence = mutableStateMapOf<String, String>()

  var messages by mutableStateOf<List<Message>>(emptyList())
    private set
  var messagesHasMore by mutableStateOf(false)
    private set
  var draft by mutableStateOf("")
  var searchQuery by mutableStateOf("")
  var searchResults by mutableStateOf<List<PublicUser>>(emptyList())
    private set

  var showCreateServer by mutableStateOf(false)
  var showJoinServer by mutableStateOf(false)
  var showNewDm by mutableStateOf(false)
  var dialogText by mutableStateOf("")

  var currentConversation by mutableStateOf<DirectConversation?>(null)
    private set
  var pendingUploads by mutableStateOf<List<PendingUpload>>(emptyList())
    private set
  var replyTo by mutableStateOf<Message?>(null)
  var editing by mutableStateOf<Message?>(null)
  var channelMuted by mutableStateOf(false)
    private set
  var blockedUsers by mutableStateOf<List<PublicUser>>(emptyList())
    private set

  init {
    bootstrap()
  }

  fun bootstrap() {
    viewModelScope.launch {
      if (!session.hasSession) {
        screen = Screen.Login
        return@launch
      }
      runCatching { withContext(Dispatchers.IO) { loadWorkspace() } }
        .onSuccess {
          screen = Screen.Home
          connectRealtime()
        }
        .onFailure {
          session.clear()
          screen = Screen.Login
        }
    }
  }

  private fun loadWorkspace() {
    me = api.me()
    servers = api.servers()
    dms = api.dms()
    val current = selectedServerId
    if (current != null) {
      serverDetail = api.server(current)
      members = api.members(current)
    }
  }

  fun login(login: String, password: String) = authAction { api.login(login.trim(), password) }

  fun register(email: String, username: String, password: String) = authAction {
    api.register(email.trim(), username.trim(), password)
  }

  private fun authAction(block: () -> ru.tetherchat.app.data.AuthResponse) {
    viewModelScope.launch {
      busy = true
      error = null
      val result = runCatching { withContext(Dispatchers.IO) { block(); loadWorkspace() } }
      busy = false
      result.onSuccess {
        screen = Screen.Home
        connectRealtime()
      }.onFailure { error = it.userMessage() }
    }
  }

  fun logout() {
    viewModelScope.launch {
      withContext(Dispatchers.IO) { runCatching { api.logout() } }
      realtime.disconnect()
      me = null
      servers = emptyList()
      dms = emptyList()
      messages = emptyList()
      blockedUsers = emptyList()
      screen = Screen.Login
    }
  }

  fun goRegister() { error = null; screen = Screen.Register }
  fun goLogin() { error = null; screen = Screen.Login }

  fun openSettings() { screen = Screen.Settings }

  fun openBlacklist() {
    screen = Screen.Blacklist
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.blocks() } }
        .onSuccess { blockedUsers = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun back() {
    when (screen) {
      is Screen.Chat -> {
        messages = emptyList()
        currentConversation = null
        pendingUploads = emptyList()
        replyTo = null
        editing = null
        draft = ""
        screen = Screen.Home
      }
      Screen.Blacklist -> screen = Screen.Settings
      Screen.Settings -> screen = Screen.Home
      Screen.Register -> screen = Screen.Login
      else -> Unit
    }
  }

  fun selectDms() {
    selectedServerId = null
    serverDetail = null
    members = emptyList()
  }

  fun selectServer(id: String) {
    selectedServerId = id
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          serverDetail = api.server(id)
          members = api.members(id)
        }
      }.onFailure { error = it.userMessage() }
    }
  }

  fun openChannel(channel: Channel) {
    openChat(channel.id, channel.serverId, "#${channel.name}", dm = false)
  }

  fun openDm(conversation: DirectConversation) {
    val title = conversation.title(me?.id.orEmpty())
    currentConversation = conversation
    openChat(conversation.id, null, title, dm = true)
  }

  fun openChat(channelId: String, serverId: String?, title: String, dm: Boolean) {
    screen = Screen.Chat(channelId, serverId, title, dm)
    messages = emptyList()
    pendingUploads = emptyList()
    replyTo = null
    editing = null
    draft = ""
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          if (dm) {
            currentConversation = dms.firstOrNull { it.id == channelId } ?: runCatching { api.conversation(channelId) }.getOrNull()
          } else {
            currentConversation = null
            if (serverId != null && selectedServerId != serverId) {
              selectedServerId = serverId
              serverDetail = api.server(serverId)
              members = api.members(serverId)
            }
            channelMuted = runCatching { api.notifications(channelId).muted }.getOrDefault(false)
          }
          val page = api.messages(channelId, dm = dm)
          messages = page.items
          messagesHasMore = page.hasMore
        }
      }.onFailure { error = it.userMessage() }
    }
  }

  fun loadOlder() {
    val chat = screen as? Screen.Chat ?: return
    val oldest = messages.firstOrNull()?.id ?: return
    if (!messagesHasMore || busy) return
    viewModelScope.launch {
      busy = true
      runCatching {
        withContext(Dispatchers.IO) { api.messages(chat.channelId, before = oldest, dm = chat.dm) }
      }.onSuccess { page ->
        messages = page.items + messages
        messagesHasMore = page.hasMore
      }
      busy = false
    }
  }

  fun send() {
    val chat = screen as? Screen.Chat ?: return
    val editingMessage = editing
    val text = draft.trim()
    if (editingMessage != null) {
      if (text.isEmpty()) return
      draft = ""
      editing = null
      viewModelScope.launch {
        runCatching { withContext(Dispatchers.IO) { api.editMessage(editingMessage.id, text) } }
          .onSuccess { updated -> replaceMessage(updated) }
          .onFailure {
            draft = text
            editing = editingMessage
            error = it.userMessage()
          }
      }
      return
    }
    val attachments = pendingUploads.mapNotNull { it.attachment }
    if (text.isEmpty() && attachments.isEmpty()) return
    if (pendingUploads.any { it.attachment == null && it.error == null }) return
    draft = ""
    val replyId = replyTo?.id
    replyTo = null
    pendingUploads = emptyList()
    val nonce = UUID.randomUUID().toString()
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          api.send(
            chat.channelId,
            text,
            chat.dm,
            nonce,
            replyToId = replyId,
            attachmentIds = attachments.map { it.id }.ifEmpty { null },
          )
        }
      }.onSuccess { message ->
        if (messages.none { it.id == message.id }) messages = messages + message
      }.onFailure {
        draft = text
        error = it.userMessage()
      }
    }
  }

  fun attachUris(uris: List<Uri>) {
    val remaining = 5 - pendingUploads.size
    if (remaining <= 0) {
      error = "Не больше 5 файлов в сообщении"
      return
    }
    uris.take(remaining).forEach { uri -> enqueueUpload(uri) }
  }

  private fun enqueueUpload(uri: Uri) {
    val resolver = getApplication<Application>().contentResolver
    val filename = queryName(resolver, uri)
    val mime = resolver.getType(uri) ?: "application/octet-stream"
    val localId = UUID.randomUUID().toString()
    pendingUploads = pendingUploads + PendingUpload(localId, filename, mime)
    viewModelScope.launch {
      val result = runCatching {
        withContext(Dispatchers.IO) {
          val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("Не удалось прочитать файл")
          if (bytes.size > 10 * 1024 * 1024) throw IllegalStateException("Файл больше 10 МБ")
          api.uploadFile(bytes, filename, mime)
        }
      }
      pendingUploads = pendingUploads.map { pending ->
        if (pending.localId != localId) pending
        else pending.copy(
          attachment = result.getOrNull(),
          error = result.exceptionOrNull()?.userMessage(),
        )
      }
      result.exceptionOrNull()?.let { error = it.userMessage() }
    }
  }

  fun removePending(localId: String) {
    pendingUploads = pendingUploads.filterNot { it.localId == localId }
  }

  fun createServer() {
    val name = dialogText.trim()
    if (name.isEmpty()) return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.createServer(name) } }
        .onSuccess { created ->
          showCreateServer = false
          dialogText = ""
          servers = listOf(
            ServerSummary(
              created.id,
              created.name,
              created.iconUrl,
              created.description,
              created.ownerId,
              created.memberCount,
            ),
          ) + servers.filterNot { it.id == created.id }
          selectServer(created.id)
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun joinServer() {
    val code = dialogText.trim().substringAfterLast('/')
    if (code.isEmpty()) return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.joinInvite(code) } }
        .onSuccess { joined ->
          showJoinServer = false
          dialogText = ""
          withContext(Dispatchers.IO) { servers = api.servers() }
          selectServer(joined)
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun searchPeople(query: String) {
    searchQuery = query
    if (query.trim().length < 2) {
      searchResults = emptyList()
      return
    }
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.searchUsers(query.trim()) } }
        .onSuccess { searchResults = it }
        .onFailure { searchResults = emptyList() }
    }
  }

  fun startDm(user: PublicUser) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.openDm(user.id) } }
        .onSuccess { conversation ->
          showNewDm = false
          searchQuery = ""
          searchResults = emptyList()
          prependDm(conversation)
          selectDms()
          openDm(conversation)
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun saveProfile(displayName: String, customStatus: String, bio: String) {
    viewModelScope.launch {
      busy = true
      runCatching {
        withContext(Dispatchers.IO) {
          api.patchMe(
            ru.tetherchat.app.data.PatchProfileBody(
              displayName = displayName.trim().ifBlank { null },
              customStatus = customStatus.trim().ifBlank { null },
              bio = bio.trim().ifBlank { null },
            ),
          )
        }
      }.onSuccess { me = it }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  fun setStatus(status: String) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.patchStatus(status) } }
        .onSuccess { me = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun uploadAvatar(uri: Uri) {
    val resolver = getApplication<Application>().contentResolver
    viewModelScope.launch {
      busy = true
      runCatching {
        withContext(Dispatchers.IO) {
          val bytes = resolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("Не удалось прочитать файл")
          val mime = resolver.getType(uri) ?: "image/jpeg"
          api.uploadAvatar(bytes, queryName(resolver, uri), mime)
        }
      }.onSuccess { me = it }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  fun removeAvatar() {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.deleteAvatar(); api.me() } }
        .onSuccess { me = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun blockUser(userId: String) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.blockUser(userId); api.dms() } }
        .onSuccess { refreshed ->
          dms = refreshed
          messages = emptyList()
          currentConversation = null
          screen = Screen.Home
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun unblockUser(userId: String) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.unblockUser(userId); api.blocks() to api.dms() } }
        .onSuccess { (blocks, conversations) ->
          blockedUsers = blocks
          dms = conversations
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun leaveGroup() {
    val conversation = currentConversation ?: return
    if (!conversation.isGroup) return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.leaveGroup(conversation.id); api.dms() } }
        .onSuccess {
          dms = it
          messages = emptyList()
          currentConversation = null
          screen = Screen.Home
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun toggleMute() {
    val chat = screen as? Screen.Chat ?: return
    if (chat.dm) return
    val next = !channelMuted
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.muteChannel(chat.channelId, next) } }
        .onSuccess { channelMuted = it.muted }
        .onFailure { error = it.userMessage() }
    }
  }

  fun react(message: Message, emoji: String) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.react(message.id, emoji) } }
        .onSuccess { event ->
          messages = messages.map { if (it.id == event.messageId) it.copy(reactions = event.reactions) else it }
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun deleteMessage(message: Message) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.deleteMessage(message.id) } }
        .onSuccess { messages = messages.filterNot { it.id == message.id } }
        .onFailure { error = it.userMessage() }
    }
  }

  fun togglePin(message: Message) {
    val chat = screen as? Screen.Chat ?: return
    if (chat.dm) return
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          if (message.pinned) api.unpin(chat.channelId, message.id) else api.pin(chat.channelId, message.id)
        }
      }.onSuccess {
        messages = messages.map { if (it.id == message.id) it.copy(pinned = !message.pinned) else it }
      }.onFailure { error = it.userMessage() }
    }
  }

  fun startReply(message: Message) {
    editing = null
    replyTo = message
  }

  fun startEdit(message: Message) {
    replyTo = null
    editing = message
    draft = message.content
  }

  fun cancelComposerExtra() {
    replyTo = null
    editing = null
  }

  fun statusOf(userId: String, fallback: String): String = presence[userId] ?: fallback

  fun isOnline(status: String?): Boolean = status == "online" || status == "idle" || status == "dnd"

  override fun onStart(owner: LifecycleOwner) {
    if (session.hasSession && screen !is Screen.Login && screen !is Screen.Register && screen !is Screen.Boot) {
      connectRealtime()
    }
  }

  override fun onStop(owner: LifecycleOwner) {
    realtime.disconnect()
  }

  private fun connectRealtime() {
    realtime.connect(
      onMessage = { message ->
        viewModelScope.launch {
          val chat = screen as? Screen.Chat
          if (chat?.channelId == message.channelId && messages.none { it.id == message.id || (message.nonce != null && it.nonce == message.nonce) }) {
            messages = messages + message
          }
          if (message.serverId == null) ensureDm(message.channelId)
        }
      },
      onMessageUpdated = { updated -> viewModelScope.launch { replaceMessage(updated) } },
      onMessageDeleted = { event ->
        viewModelScope.launch { messages = messages.filterNot { it.id == event.messageId } }
      },
      onReaction = { event ->
        viewModelScope.launch {
          messages = messages.map { if (it.id == event.messageId) it.copy(reactions = event.reactions) else it }
        }
      },
      onDmCreate = { conversation -> viewModelScope.launch { prependDm(conversation) } },
      onPresence = { event -> viewModelScope.launch { presence[event.userId] = event.status } },
      onReady = {},
    )
  }

  private fun replaceMessage(updated: Message) {
    messages = messages.map { if (it.id == updated.id) updated else it }
  }

  private fun prependDm(conversation: DirectConversation) {
    dms = listOf(conversation) + dms.filterNot { it.id == conversation.id }
  }

  private suspend fun ensureDm(conversationId: String) {
    if (dms.any { it.id == conversationId }) return
    runCatching { withContext(Dispatchers.IO) { api.conversation(conversationId) } }
      .onSuccess { prependDm(it) }
      .onFailure {
        runCatching { withContext(Dispatchers.IO) { api.dms() } }.onSuccess { dms = it }
      }
  }

  override fun onCleared() {
    realtime.disconnect()
    super.onCleared()
  }
}

private fun queryName(resolver: ContentResolver, uri: Uri): String {
  resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
    if (cursor.moveToFirst()) {
      val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      if (index >= 0) return cursor.getString(index) ?: "file"
    }
  }
  return uri.lastPathSegment?.substringAfterLast('/') ?: "file"
}

private fun Throwable.userMessage(): String = (this as? ApiException)?.message ?: (message ?: "Не удалось выполнить запрос")
