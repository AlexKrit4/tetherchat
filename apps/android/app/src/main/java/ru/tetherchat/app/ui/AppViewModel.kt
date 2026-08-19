package ru.tetherchat.app.ui

import android.app.Application
import android.content.ContentResolver
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.provider.Settings
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.FileProvider
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.viewModelScope
import java.io.File
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.tetherchat.app.BuildConfig
import ru.tetherchat.app.ForegroundState
import ru.tetherchat.app.NotificationHelper
import ru.tetherchat.app.PushRegistrar
import ru.tetherchat.app.data.AndroidRelease
import ru.tetherchat.app.data.ApiException
import ru.tetherchat.app.data.Ban
import ru.tetherchat.app.data.Channel
import ru.tetherchat.app.data.DeviceSession
import ru.tetherchat.app.data.DirectConversation
import ru.tetherchat.app.data.DraftStore
import ru.tetherchat.app.data.ReceiptUpdate
import ru.tetherchat.app.data.Invite
import ru.tetherchat.app.data.InvitePreview
import ru.tetherchat.app.data.Message
import ru.tetherchat.app.data.PatchMemberBody
import ru.tetherchat.app.data.PatchRoleBody
import ru.tetherchat.app.data.PendingUpload
import ru.tetherchat.app.data.PublicUser
import ru.tetherchat.app.data.ReadState
import ru.tetherchat.app.data.RealtimeClient
import ru.tetherchat.app.data.RealtimeHandlers
import ru.tetherchat.app.data.Role
import ru.tetherchat.app.data.SelfUser
import ru.tetherchat.app.data.ServerDetail
import ru.tetherchat.app.data.ServerMember
import ru.tetherchat.app.data.ServerSummary
import ru.tetherchat.app.data.SessionStore
import ru.tetherchat.app.data.TetherApi
import ru.tetherchat.app.data.can
import java.util.UUID

sealed class Screen {
  data object Boot : Screen()
  data object Login : Screen()
  data object Register : Screen()
  data object ForgotPassword : Screen()
  data class ResetPassword(val token: String) : Screen()
  data class VerifyEmail(val token: String) : Screen()
  data class Invite(val code: String) : Screen()
  data object Home : Screen()
  data object Settings : Screen()
  data object ProfileSettings : Screen()
  data object AccountSettings : Screen()
  data object Sessions : Screen()
  data object AppearanceSettings : Screen()
  data object Blacklist : Screen()
  data object ServerSettings : Screen()
  data object Members : Screen()
  data class UserProfile(val userId: String) : Screen()
  data class Chat(
    val channelId: String,
    val serverId: String?,
    val title: String,
    val dm: Boolean,
  ) : Screen()
}

data class ForwardTarget(
  val id: String,
  val title: String,
  val subtitle: String,
  val dm: Boolean,
)

data class VoiceDraft(
  val file: File,
  val durationMs: Int,
  val samples: List<Float>,
)

class AppViewModel(application: Application) : AndroidViewModel(application), DefaultLifecycleObserver {
  private val session = SessionStore.get(application)
  private val drafts = DraftStore.get(application)
  private val api = TetherApi(session)
  private val realtime = RealtimeClient(api, api.json)

  var screen by mutableStateOf<Screen>(Screen.Boot)
    private set
  var me by mutableStateOf<SelfUser?>(null)
    private set
  var error by mutableStateOf<String?>(null)
  var busy by mutableStateOf(false)
    private set
  var availableUpdate by mutableStateOf<AndroidRelease?>(null)
    private set
  var updateDownloading by mutableStateOf(false)
    private set
  var updateProgress by mutableStateOf(0f)
    private set
  var updateBytesRead by mutableStateOf(0L)
    private set
  var updateBytesTotal by mutableStateOf(-1L)
    private set
  var updateFailed by mutableStateOf<String?>(null)
    private set
  var pendingInstall by mutableStateOf(false)
    private set
  var needsInstallPermission by mutableStateOf(false)
    private set
  private var dismissedUpdateCode: Int? = null
  private var updateCheckJob: Job? = null
  private var downloadJob: Job? = null
  private var downloadedApk: File? = null

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
  var recording by mutableStateOf(false)
    private set
  var recordElapsedMs by mutableStateOf(0L)
    private set
  var voiceDraft by mutableStateOf<VoiceDraft?>(null)
    private set
  var forwarding by mutableStateOf<Message?>(null)
  var forwardTargets by mutableStateOf<List<ForwardTarget>>(emptyList())
    private set
  var sessions by mutableStateOf<List<DeviceSession>>(emptyList())
    private set
  private var recorder: MediaRecorder? = null
  private var recordFile: File? = null
  private var recordStartedAt = 0L
  private var recordTicker: Job? = null
  private val recordSamples = mutableListOf<Float>()
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
  var readStates = mutableStateMapOf<String, ReadState>()
  var connected by mutableStateOf(true)
  var typingLabel by mutableStateOf<String?>(null)
    private set
  var pins by mutableStateOf<List<Message>>(emptyList())
    private set
  var messageHits by mutableStateOf<List<Message>>(emptyList())
    private set
  var messageSearch by mutableStateOf("")
  var invitePreview by mutableStateOf<InvitePreview?>(null)
  var profileUser by mutableStateOf<PublicUser?>(null)
  var bans by mutableStateOf<List<Ban>>(emptyList())
    private set
  var invites by mutableStateOf<List<Invite>>(emptyList())
    private set
  var editingRole by mutableStateOf<Role?>(null)
  var collapsedCategories = mutableStateMapOf<String, Boolean>()
  var selectedDmUsers by mutableStateOf<List<PublicUser>>(emptyList())
  var groupName by mutableStateOf("")
  var showServerMenu by mutableStateOf(false)
  var showCreateChannel by mutableStateOf(false)
  var showCreateCategory by mutableStateOf(false)
  var showChannelSettings by mutableStateOf(false)
  var channelForSettings by mutableStateOf<Channel?>(null)
  var showPins by mutableStateOf(false)
  var showSearch by mutableStateOf(false)
  var showEmojiPicker by mutableStateOf(false)
  var pendingInviteCode by mutableStateOf<String?>(null)
  private var typingJob: Job? = null
  private var subscribedChannel: String? = null
  private var lastChat: Screen.Chat? = null
  private var pendingDeepLinkPath: String? = null
  private var pendingDeepLinkToken: String? = null
  private val channelServerIds = mutableMapOf<String, String>()

  init {
    bootstrap()
  }

  fun bootstrap() {
    checkForUpdate()
    viewModelScope.launch {
      if (!session.hasSession) {
        screen = Screen.Login
        consumePendingDeepLink()
        return@launch
      }
      runCatching { withContext(Dispatchers.IO) { loadWorkspace() } }
        .onSuccess {
          screen = Screen.Home
          connectRealtime()
          PushRegistrar.sync(getApplication())
          consumePendingDeepLink()
        }
        .onFailure {
          session.clear()
          screen = Screen.Login
          consumePendingDeepLink()
        }
    }
  }

  private fun loadWorkspace() {
    me = api.me()
    servers = api.servers()
    dms = api.dms()
    api.readStates().forEach { readStates[it.channelId] = it }
    val current = selectedServerId
    if (current != null) {
      serverDetail = api.server(current)
      members = api.members(current)
      rememberChannels(serverDetail)
    }
  }

  fun login(login: String, password: String) = authAction { api.login(login.trim(), password) }

  fun register(email: String, username: String, password: String) = authAction {
    api.register(email.trim(), username.trim(), password)
  }

  fun checkForUpdate() {
    if (updateCheckJob?.isActive == true || updateDownloading || pendingInstall) return
    updateCheckJob = viewModelScope.launch {
      val release = withContext(Dispatchers.IO) { runCatching { api.androidRelease() }.getOrNull() } ?: return@launch
      if (release.versionCode <= BuildConfig.VERSION_CODE) return@launch
      if (dismissedUpdateCode == release.versionCode) return@launch
      val rawUrl = release.url.trim()
      val url = when {
        rawUrl.startsWith("http://") || rawUrl.startsWith("https://") -> rawUrl
        rawUrl.startsWith("/") -> BuildConfig.API_URL.trimEnd('/') + rawUrl
        else -> "${BuildConfig.API_URL.trimEnd('/')}/app/tetherchat.apk"
      }
      availableUpdate = release.copy(url = url)
    }
  }

  fun startUpdateDownload() {
    val release = availableUpdate ?: return
    if (downloadJob?.isActive == true) return
    updateFailed = null
    needsInstallPermission = false
    val dest = updateFile(release.versionCode)
    if (dest.exists() && dest.length() > 100_000L) {
      downloadedApk = dest
      updateProgress = 1f
      pendingInstall = true
      installDownloadedUpdate()
      return
    }
    updateDownloading = true
    updateProgress = 0f
    updateBytesRead = 0L
    updateBytesTotal = -1L
    pendingInstall = false
    downloadJob = viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          var lastPosted = 0L
          api.downloadTo(release.url, dest) { read, total ->
            if (read - lastPosted < 128 * 1024 && total > 0 && read < total) return@downloadTo
            lastPosted = read
            updateBytesRead = read
            updateBytesTotal = total
            updateProgress = if (total > 0) (read.toFloat() / total.toFloat()).coerceIn(0f, 1f) else 0f
          }
        }
      }.onSuccess {
        downloadedApk = dest
        updateBytesRead = dest.length()
        updateBytesTotal = dest.length()
        updateProgress = 1f
        updateDownloading = false
        pendingInstall = true
        installDownloadedUpdate()
      }.onFailure { error ->
        if (error is CancellationException) return@onFailure
        updateDownloading = false
        pendingInstall = false
        downloadedApk = null
        dest.delete()
        updateFailed = error.userMessage()
      }
    }
  }

  fun installDownloadedUpdate() {
    val file = downloadedApk?.takeIf { it.exists() && it.length() > 0 } ?: return
    val app = getApplication<Application>()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !app.packageManager.canRequestPackageInstalls()) {
      needsInstallPermission = true
      return
    }
    needsInstallPermission = false
    val uri = FileProvider.getUriForFile(app, "${app.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, "application/vnd.android.package-archive")
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val resolvers = app.packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
    for (info in resolvers) {
      app.grantUriPermission(
        info.activityInfo.packageName,
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
    }
    runCatching { app.startActivity(intent) }
      .onFailure { updateFailed = "Не удалось открыть установщик. Разрешите установку из этого приложения." }
  }

  fun openInstallPermissionSettings() {
    val app = getApplication<Application>()
    val intent = Intent(
      Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
      Uri.parse("package:${app.packageName}"),
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    runCatching { app.startActivity(intent) }
  }

  fun resumePendingInstall() {
    if (!pendingInstall || updateDownloading || downloadedApk?.exists() != true) return
    val app = getApplication<Application>()
    val allowed = Build.VERSION.SDK_INT < Build.VERSION_CODES.O || app.packageManager.canRequestPackageInstalls()
    if (needsInstallPermission && allowed) {
      installDownloadedUpdate()
    }
  }

  fun dismissUpdate() {
    downloadJob?.cancel()
    downloadJob = null
    updateDownloading = false
    dismissedUpdateCode = availableUpdate?.versionCode
    availableUpdate = null
    updateFailed = null
    pendingInstall = false
    needsInstallPermission = false
    updateProgress = 0f
  }

  private fun updateFile(versionCode: Int): File {
    return File(getApplication<Application>().cacheDir, "updates/tetherchat-$versionCode.apk")
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
        PushRegistrar.sync(getApplication())
        consumePendingDeepLink()
        pendingInviteCode?.let { code ->
          dialogText = code
          joinServer()
        }
      }.onFailure { error = it.userMessage() }
    }
  }

  fun logout() {
    viewModelScope.launch {
      withContext(Dispatchers.IO) {
        runCatching { PushRegistrar.unregister(getApplication()) }
        runCatching { api.logout() }
      }
      realtime.disconnect()
      me = null
      servers = emptyList()
      dms = emptyList()
      messages = emptyList()
      blockedUsers = emptyList()
      screen = Screen.Login
    }
  }

  fun goHome() { screen = Screen.Home }

  fun goRegister() { error = null; screen = Screen.Register }
  fun goLogin() { error = null; screen = Screen.Login }
  fun goForgot() { error = null; screen = Screen.ForgotPassword }

  fun openSettings() { screen = Screen.Settings }
  fun openProfileSettings() { screen = Screen.ProfileSettings }
  fun openAccountSettings() { screen = Screen.AccountSettings }

  fun openSessions() {
    screen = Screen.Sessions
    loadSessions()
  }

  fun loadSessions() {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.sessions() } }
        .onSuccess { sessions = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun revokeSession(id: String) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.revokeSession(id); api.sessions() } }
        .onSuccess { sessions = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun revokeOtherSessions() {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.revokeOtherSessions(); api.sessions() } }
        .onSuccess { sessions = it }
        .onFailure { error = it.userMessage() }
    }
  }
  fun openAppearanceSettings() { screen = Screen.AppearanceSettings }
  fun openServerSettings() {
    val id = selectedServerId ?: return
    screen = Screen.ServerSettings
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          bans = runCatching { api.bans(id) }.getOrDefault(emptyList())
          invites = runCatching { api.invites(id) }.getOrDefault(emptyList())
        }
      }
    }
  }

  fun openMembers() { screen = Screen.Members }

  fun openProfile(userId: String) {
    screen = Screen.UserProfile(userId)
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.user(userId) } }
        .onSuccess { profileUser = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun openDeepLink(path: String, queryToken: String?) {
    if (screen == Screen.Boot) {
      pendingDeepLinkPath = path
      pendingDeepLinkToken = queryToken
      return
    }
    applyDeepLink(path, queryToken)
  }

  private fun consumePendingDeepLink() {
    val path = pendingDeepLinkPath ?: return
    pendingDeepLinkPath = null
    val token = pendingDeepLinkToken
    pendingDeepLinkToken = null
    applyDeepLink(path, token)
  }

  private fun applyDeepLink(path: String, queryToken: String?) {
    val parts = path.trim('/').split('/')
    when {
      parts.getOrNull(0) == "invite" && !parts.getOrNull(1).isNullOrBlank() -> openInvite(parts[1])
      parts.getOrNull(0) == "forgot-password" -> goForgot()
      parts.getOrNull(0) == "reset-password" && !queryToken.isNullOrBlank() -> {
        error = null; screen = Screen.ResetPassword(queryToken)
      }
      parts.getOrNull(0) == "verify-email" && !queryToken.isNullOrBlank() -> {
        error = null; screen = Screen.VerifyEmail(queryToken)
      }
    }
  }

  fun openInvite(code: String) {
    if (!session.hasSession) pendingInviteCode = code
    screen = Screen.Invite(code)
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.invitePreview(code) } }
        .onSuccess { invitePreview = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun continueInviteLogin() {
    val code = (screen as? Screen.Invite)?.code ?: return
    pendingInviteCode = code
    goLogin()
  }

  fun acceptInvite() {
    val screenInvite = screen as? Screen.Invite ?: return
    if (!session.hasSession) {
      pendingInviteCode = screenInvite.code
      goLogin()
      return
    }
    dialogText = screenInvite.code
    joinServer()
  }

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
        saveCurrentDraft()
        cancelVoiceRecord()
        subscribedChannel?.let { realtime.unsubscribe(it) }
        subscribedChannel = null
        messages = emptyList()
        currentConversation = null
        pendingUploads = emptyList()
        replyTo = null
        editing = null
        draft = ""
        typingLabel = null
        showPins = false
        showSearch = false
        forwarding = null
        screen = Screen.Home
      }
      Screen.Blacklist -> screen = Screen.Settings
      Screen.Sessions -> screen = Screen.AccountSettings
      Screen.ProfileSettings, Screen.AccountSettings, Screen.AppearanceSettings -> screen = Screen.Settings
      Screen.Settings, Screen.ServerSettings -> screen = Screen.Home
      Screen.Members -> screen = lastChat ?: Screen.Home
      is Screen.UserProfile -> screen = lastChat ?: Screen.Home
      is Screen.Invite -> screen = if (session.hasSession) Screen.Home else Screen.Login
      Screen.Register, Screen.ForgotPassword, is Screen.ResetPassword, is Screen.VerifyEmail ->
        screen = Screen.Login
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
          rememberChannels(serverDetail)
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
    saveCurrentDraft()
    cancelVoiceRecord()
    subscribedChannel?.let { realtime.unsubscribe(it) }
    val chat = Screen.Chat(channelId, serverId, title, dm)
    lastChat = chat
    screen = chat
    messages = emptyList()
    pendingUploads = emptyList()
    replyTo = null
    editing = null
    forwarding = null
    draft = drafts.get(channelId)
    typingLabel = null
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
              rememberChannels(serverDetail)
            }
            channelMuted = runCatching { api.notifications(channelId).muted }.getOrDefault(false)
          }
          val page = api.messages(channelId, dm = dm)
          messages = page.items
          messagesHasMore = page.hasMore
        }
      }.onSuccess {
        realtime.subscribe(channelId)
        subscribedChannel = channelId
        ackVisible()
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
      draft = drafts.get(chat.channelId)
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
    drafts.set(chat.channelId, "")
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
          pendingInviteCode = null
          withContext(Dispatchers.IO) { servers = api.servers() }
          selectServer(joined)
          screen = Screen.Home
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
    val chat = screen as? Screen.Chat
    replyTo = null
    editing = null
    draft = chat?.let { drafts.get(it.channelId) }.orEmpty()
  }

  fun canPerm(flag: Int): Boolean = serverDetail?.permissions?.can(flag) == true

  fun isOwner(): Boolean = serverDetail?.ownerId == me?.id

  fun statusOf(userId: String, fallback: String): String = presence[userId] ?: fallback

  fun isOnline(status: String?): Boolean = status == "online" || status == "idle" || status == "dnd"

  fun unread(channelId: String): Boolean = readStates[channelId]?.unread == true

  fun mentions(channelId: String): Int = readStates[channelId]?.mentionCount ?: 0

  fun serverUnread(serverId: String): Boolean =
    readStates.any { (channelId, state) ->
      channelServerIds[channelId] == serverId && (state.unread || state.mentionCount > 0)
    }

  fun serverMentions(serverId: String): Int =
    readStates.entries.filter { channelServerIds[it.key] == serverId }.sumOf { it.value.mentionCount }

  fun toggleCollapsed(categoryId: String) {
    collapsedCategories[categoryId] = !(collapsedCategories[categoryId] ?: false)
  }

  fun openChannelSettings(channel: Channel) {
    channelForSettings = channel
    dialogText = channel.name
    showChannelSettings = true
  }

  fun openDmFromProfile() {
    val user = profileUser ?: return
    startDm(user)
  }

  fun updateDraft(text: String) {
    draft = text
    val chat = screen as? Screen.Chat ?: return
    if (editing == null) drafts.set(chat.channelId, text)
    if (text.isBlank()) {
      realtime.typingStop(chat.channelId)
      typingJob?.cancel()
      return
    }
    realtime.typingStart(chat.channelId)
    typingJob?.cancel()
    typingJob = viewModelScope.launch {
      delay(8_000)
      realtime.typingStop(chat.channelId)
    }
  }

  fun ackVisible() {
    val chat = screen as? Screen.Chat ?: return
    val last = messages.lastOrNull() ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.ack(chat.channelId, last.id, chat.dm) } }
        .onSuccess {
          readStates[chat.channelId] = ReadState(chat.channelId, last.id, unread = false, mentionCount = 0)
        }
    }
  }

  fun searchInChat(query: String) {
    messageSearch = query
    val chat = screen as? Screen.Chat ?: return
    if (query.trim().length < 2) {
      messageHits = emptyList()
      return
    }
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.searchMessages(chat.channelId, query.trim(), chat.dm) } }
        .onSuccess { messageHits = it }
        .onFailure { messageHits = emptyList() }
    }
  }

  fun loadPins() {
    val chat = screen as? Screen.Chat ?: return
    if (chat.dm) return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.pins(chat.channelId) } }
        .onSuccess { pins = it }
    }
  }

  fun forgot(email: String) {
    viewModelScope.launch {
      busy = true
      runCatching { withContext(Dispatchers.IO) { api.forgotPassword(email.trim()) } }
        .onSuccess { error = "Если этот адрес есть в системе, письмо уже в пути." }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  fun resetPassword(token: String, password: String) {
    viewModelScope.launch {
      busy = true
      runCatching { withContext(Dispatchers.IO) { api.resetPassword(token, password) } }
        .onSuccess { error = null; screen = Screen.Login }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  fun verifyEmailToken(token: String) {
    viewModelScope.launch {
      busy = true
      runCatching { withContext(Dispatchers.IO) { api.verifyEmail(token) } }
        .onSuccess { error = null; if (session.hasSession) bootstrap() else screen = Screen.Login }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  fun saveUsername(username: String) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.patchUsername(username.trim().lowercase()) } }
        .onSuccess { me = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun setEnterToSend(value: Boolean) {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.patchEnterToSend(value) } }
        .onSuccess { me = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun requestPasswordReset() {
    val email = me?.email ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.forgotPassword(email) } }
        .onSuccess { error = "Ссылка сброса отправлена на почту" }
        .onFailure { error = it.userMessage() }
    }
  }

  fun createChannel() {
    val serverId = selectedServerId ?: return
    val name = dialogText.trim()
    if (name.isEmpty()) return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.createChannel(serverId, name, null, null); api.server(serverId) } }
        .onSuccess {
          showCreateChannel = false
          dialogText = ""
          serverDetail = it
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun createCategory() {
    val serverId = selectedServerId ?: return
    val name = dialogText.trim()
    if (name.isEmpty()) return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.createCategory(serverId, name); api.server(serverId) } }
        .onSuccess {
          showCreateCategory = false
          dialogText = ""
          serverDetail = it
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun saveChannel(name: String, topic: String) {
    val channel = channelForSettings ?: return
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          api.patchChannel(channel.id, name.trim(), topic.trim().ifBlank { null })
          api.server(channel.serverId)
        }
      }.onSuccess {
        serverDetail = it
        showChannelSettings = false
      }.onFailure { error = it.userMessage() }
    }
  }

  fun deleteChannel() {
    val channel = channelForSettings ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.deleteChannel(channel.id); api.server(channel.serverId) } }
        .onSuccess {
          serverDetail = it
          showChannelSettings = false
          if ((screen as? Screen.Chat)?.channelId == channel.id) screen = Screen.Home
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun leaveServer() {
    val id = selectedServerId ?: return
    if (isOwner()) return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.leaveServer(id); api.servers() } }
        .onSuccess {
          servers = it
          selectDms()
          screen = Screen.Home
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun saveServer(name: String, description: String) {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.patchServer(id, name.trim(), description.trim().ifBlank { null }); api.server(id) } }
        .onSuccess { serverDetail = it; refreshServers() }
        .onFailure { error = it.userMessage() }
    }
  }

  fun uploadServerIcon(uri: Uri) {
    val id = selectedServerId ?: return
    val resolver = getApplication<Application>().contentResolver
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          val bytes = resolver.openInputStream(uri)?.use { it.readBytes() } ?: error("file")
          api.uploadServerIcon(id, bytes, queryName(resolver, uri), resolver.getType(uri) ?: "image/jpeg")
          api.server(id)
        }
      }.onSuccess { serverDetail = it; refreshServers() }
        .onFailure { error = it.userMessage() }
    }
  }

  fun deleteCurrentServer() {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.deleteServer(id); api.servers() } }
        .onSuccess {
          servers = it
          selectDms()
          screen = Screen.Home
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun createInviteLink() {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.createInvite(id) } }
        .onSuccess { created ->
          invites = listOf(created) + invites
          error = "https://tetherchat.ru/invite/${created.code}"
        }
        .onFailure { error = it.userMessage() }
    }
  }

  fun createRole(name: String) {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.createRole(id, name); api.server(id) } }
        .onSuccess { serverDetail = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun saveRole(role: Role, name: String, permissions: Int, hoist: Boolean, color: String) {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          api.patchRole(id, role.id, PatchRoleBody(name = name, permissions = permissions, hoist = hoist, color = color))
          api.server(id)
        }
      }.onSuccess { serverDetail = it; editingRole = null }
        .onFailure { error = it.userMessage() }
    }
  }

  fun deleteRole(role: Role) {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.deleteRole(id, role.id); api.server(id) } }
        .onSuccess { serverDetail = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun kick(userId: String) {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.kickMember(id, userId); api.members(id) } }
        .onSuccess { members = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun ban(userId: String) {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.banMember(id, userId, null); api.members(id) to api.bans(id) } }
        .onSuccess { (m, b) -> members = m; bans = b }
        .onFailure { error = it.userMessage() }
    }
  }

  fun unban(userId: String) {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.unbanMember(id, userId); api.bans(id) } }
        .onSuccess { bans = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun setMemberRoles(userId: String, roleIds: List<String>) {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.patchMember(id, userId, PatchMemberBody(roleIds = roleIds)); api.members(id) } }
        .onSuccess { members = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun toggleDmUser(user: PublicUser) {
    selectedDmUsers = if (selectedDmUsers.any { it.id == user.id }) selectedDmUsers.filterNot { it.id == user.id }
    else selectedDmUsers + user
  }

  fun startGroupOrDm() {
    val ids = selectedDmUsers.map { it.id }
    if (ids.isEmpty()) return
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          if (ids.size == 1) api.openDm(ids.first())
          else api.openGroup(ids, groupName.trim().ifBlank { null })
        }
      }.onSuccess { conversation ->
        showNewDm = false
        searchQuery = ""
        searchResults = emptyList()
        selectedDmUsers = emptyList()
        groupName = ""
        prependDm(conversation)
        selectDms()
        openDm(conversation)
      }.onFailure { error = it.userMessage() }
    }
  }

  fun copyInvite(code: String): String = "https://tetherchat.ru/invite/$code"

  private fun refreshServers() {
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.servers() } }.onSuccess { servers = it }
    }
  }

  private fun refreshSelectedServer() {
    val id = selectedServerId ?: return
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          serverDetail = api.server(id)
          members = api.members(id)
          rememberChannels(serverDetail)
        }
      }
    }
  }

  private fun rememberChannels(detail: ServerDetail?) {
    detail?.channels?.forEach { channelServerIds[it.id] = detail.id }
  }

  override fun onStart(owner: LifecycleOwner) {
    checkForUpdate()
    if (session.hasSession && screen !is Screen.Login && screen !is Screen.Register && screen !is Screen.Boot &&
      screen !is Screen.ForgotPassword
    ) {
      if (!realtime.connected()) connectRealtime()
    }
  }

  override fun onStop(owner: LifecycleOwner) {
    val chat = screen as? Screen.Chat
    if (chat != null) realtime.typingStop(chat.channelId)
  }

  private fun connectRealtime() {
    realtime.onConnection = { connected = it }
    realtime.connect(
      RealtimeHandlers(
        onMessage = { message ->
          viewModelScope.launch {
            val chat = screen as? Screen.Chat
            if (chat?.channelId == message.channelId && messages.none { it.id == message.id || (message.nonce != null && it.nonce == message.nonce) }) {
              messages = messages + message
              if (ForegroundState.inForeground) ackVisible()
            } else if (message.authorId != me?.id) {
              val state = readStates[message.channelId]
              readStates[message.channelId] = ReadState(
                channelId = message.channelId,
                lastReadMessageId = state?.lastReadMessageId,
                mentionCount = (state?.mentionCount ?: 0) + if (message.content.contains("@${me?.username}")) 1 else 0,
                unread = true,
              )
            }
            message.serverId?.let { channelServerIds[message.channelId] = it }
            if (message.serverId == null) ensureDm(message.channelId)
            if (!ForegroundState.inForeground && message.authorId != me?.id) {
              val title = message.author.label
              val body = message.content.ifBlank { if (message.attachments.isNotEmpty()) "Вложение" else "Новое сообщение" }
              NotificationHelper.showMessage(
                getApplication(),
                title,
                body,
                message.channelId,
                message.serverId,
                title,
                message.id,
              )
            }
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
        onReceipt = { event -> viewModelScope.launch { applyReceipt(event) } },
        onPresence = { event -> viewModelScope.launch { presence[event.userId] = event.status } },
        onTyping = { event ->
          viewModelScope.launch {
            val chat = screen as? Screen.Chat
            if (chat?.channelId != event.channelId) return@launch
            val others = event.users.filter { it.id != me?.id }
            typingLabel = when {
              others.isEmpty() -> null
              others.size == 1 -> "${others.first().username} печатает…"
              else -> "${others.joinToString { it.username }} печатают…"
            }
          }
        },
        onServerChanged = { refreshSelectedServer() },
        onServersChanged = { refreshServers() },
        onReady = {
          (screen as? Screen.Chat)?.let { realtime.subscribe(it.channelId) }
        },
      ),
    )
  }

  private fun replaceMessage(updated: Message) {
    messages = messages.map { if (it.id == updated.id) updated else it }
  }

  private fun prependDm(conversation: DirectConversation) {
    val rest = dms.filterNot { it.id == conversation.id }
    dms = if (conversation.isSaved) {
      listOf(conversation) + rest
    } else {
      rest.filter { it.isSaved } + listOf(conversation) + rest.filterNot { it.isSaved }
    }
  }

  private fun applyReceipt(event: ReceiptUpdate) {
    if (event.userId == me?.id) return
    fun patch(conversation: DirectConversation): DirectConversation {
      if (conversation.id != event.conversationId) return conversation
      return conversation.copy(
        peerLastReadMessageId = event.lastReadMessageId,
        peerLastReadAt = event.lastReadAt,
      )
    }
    dms = dms.map(::patch)
    currentConversation = currentConversation?.let(::patch)
  }

  private fun saveCurrentDraft() {
    val chat = screen as? Screen.Chat ?: return
    if (editing == null) drafts.set(chat.channelId, draft)
  }

  fun startForward(message: Message) {
    forwarding = message
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          val meId = me?.id.orEmpty()
          val dmTargets = dms.map {
            ForwardTarget(it.id, it.title(meId), if (it.isSaved) "Сохранённые" else "Личные сообщения", true)
          }
          val channelTargets = servers.flatMap { summary ->
            val detail = if (serverDetail?.id == summary.id) serverDetail!! else api.server(summary.id)
            val allowed = detail.ownerId == me?.id || detail.permissions.can(ru.tetherchat.app.data.Perm.SEND_MESSAGES)
            if (!allowed) emptyList()
            else detail.channels.map { channel ->
              ForwardTarget(channel.id, "#${channel.name}", detail.name, false)
            }
          }
          dmTargets + channelTargets
        }
      }.onSuccess { forwardTargets = it }.onFailure { error = it.userMessage() }
    }
  }

  fun forwardTo(channelId: String, dm: Boolean) {
    val message = forwarding ?: return
    forwarding = null
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          api.send(
            channelId,
            "",
            dm,
            UUID.randomUUID().toString(),
            forwardMessageId = message.id,
          )
        }
      }.onSuccess {
        error = "Сообщение переслано"
        val chat = screen as? Screen.Chat
        if (chat?.channelId == channelId && messages.none { row -> row.id == it.id }) {
          messages = messages + it
        }
      }.onFailure { error = it.userMessage() }
    }
  }

  fun startVoiceRecord(): Boolean {
    if (screen !is Screen.Chat) return false
    if (recording) return true
    discardVoiceDraft()
    val file = File(getApplication<Application>().cacheDir, "voice-${System.currentTimeMillis()}.m4a")
    return runCatching {
      @Suppress("DEPRECATION")
      val next = MediaRecorder().apply {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setAudioSamplingRate(44_100)
        setAudioEncodingBitRate(128_000)
        setOutputFile(file.absolutePath)
        prepare()
        start()
      }
      recorder = next
      recordFile = file
      recordStartedAt = System.currentTimeMillis()
      recordSamples.clear()
      recording = true
      recordElapsedMs = 0
      recordTicker?.cancel()
      recordTicker = viewModelScope.launch {
        while (recording) {
          delay(80)
          recordElapsedMs = System.currentTimeMillis() - recordStartedAt
          val amplitude = runCatching { recorder?.maxAmplitude ?: 0 }.getOrDefault(0)
          val sample = (amplitude / 32767f).coerceIn(0.05f, 1f)
          if (recordSamples.size < 400) recordSamples.add(sample)
        }
      }
      true
    }.getOrElse {
      error = "Не удалось начать запись"
      file.delete()
      false
    }
  }

  fun finishVoiceRecord() {
    if (!recording && recorder == null) return
    val file = recordFile
    val duration = (System.currentTimeMillis() - recordStartedAt).toInt()
    val samples = recordSamples.toList()
    runCatching { recorder?.stop() }
    runCatching { recorder?.release() }
    recorder = null
    recording = false
    recordTicker?.cancel()
    recordElapsedMs = 0
    recordFile = null
    recordSamples.clear()
    if (file == null || duration < 400) {
      file?.delete()
      return
    }
    voiceDraft = VoiceDraft(
      file = file,
      durationMs = duration,
      samples = samples.ifEmpty { listOf(0.2f, 0.35f, 0.25f, 0.4f, 0.3f) },
    )
  }

  fun cancelVoiceRecord() {
    if (recording || recorder != null) {
      runCatching { recorder?.stop() }
      runCatching { recorder?.release() }
      recorder = null
      recording = false
      recordTicker?.cancel()
      recordElapsedMs = 0
      recordFile?.delete()
      recordFile = null
      recordSamples.clear()
    }
    discardVoiceDraft()
  }

  fun discardVoiceDraft() {
    voiceDraft?.file?.delete()
    voiceDraft = null
  }

  fun sendVoiceDraft() {
    val clip = voiceDraft ?: return
    val chat = screen as? Screen.Chat ?: return
    voiceDraft = null
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) {
          val bytes = clip.file.readBytes()
          val attachment = api.uploadFile(bytes, "voice.m4a", "audio/mp4", clip.durationMs)
          api.send(
            chat.channelId,
            "",
            chat.dm,
            UUID.randomUUID().toString(),
            attachmentIds = listOf(attachment.id),
            attachmentDurations = mapOf(attachment.id to clip.durationMs),
          )
        }
      }.onSuccess { message ->
        clip.file.delete()
        if (messages.none { it.id == message.id }) messages = messages + message
      }.onFailure {
        voiceDraft = clip
        error = it.userMessage()
      }
    }
  }

  override fun onCleared() {
    cancelVoiceRecord()
    realtime.disconnect()
    super.onCleared()
  }

  private suspend fun ensureDm(conversationId: String) {
    if (dms.any { it.id == conversationId }) return
    runCatching { withContext(Dispatchers.IO) { api.conversation(conversationId) } }
      .onSuccess { prependDm(it) }
      .onFailure {
        runCatching { withContext(Dispatchers.IO) { api.dms() } }.onSuccess { dms = it }
      }
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
