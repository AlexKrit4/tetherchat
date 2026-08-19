package ru.tetherchat.app.ui

import android.app.Application
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
      screen = Screen.Login
    }
  }

  fun goRegister() { error = null; screen = Screen.Register }
  fun goLogin() { error = null; screen = Screen.Login }

  fun back() {
    when (screen) {
      is Screen.Chat -> {
        messages = emptyList()
        screen = Screen.Home
      }
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
    openChat(conversation.id, null, title, dm = true)
  }

  fun openChat(channelId: String, serverId: String?, title: String, dm: Boolean) {
    screen = Screen.Chat(channelId, serverId, title, dm)
    messages = emptyList()
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          if (serverId != null && selectedServerId != serverId) {
            selectedServerId = serverId
            serverDetail = api.server(serverId)
            members = api.members(serverId)
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
    val text = draft.trim()
    if (text.isEmpty()) return
    draft = ""
    val nonce = UUID.randomUUID().toString()
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) { api.send(chat.channelId, text, chat.dm, nonce) }
      }.onSuccess { message ->
        if (messages.none { it.id == message.id }) messages = messages + message
      }.onFailure {
        draft = text
        error = it.userMessage()
      }
    }
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
            ru.tetherchat.app.data.ServerSummary(
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
          dms = listOf(conversation) + dms.filterNot { it.id == conversation.id }
          selectDms()
          openDm(conversation)
        }
        .onFailure { error = it.userMessage() }
    }
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
          if (chat?.channelId == message.channelId && messages.none { it.id == message.id }) {
            messages = messages + message
          }
        }
      },
      onPresence = { event ->
        viewModelScope.launch { presence[event.userId] = event.status }
      },
      onReady = {},
    )
  }

  override fun onCleared() {
    realtime.disconnect()
    super.onCleared()
  }
}

private fun Throwable.userMessage(): String = (this as? ApiException)?.message ?: "Не удалось выполнить запрос"
