package ru.tetherchat.admin.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.tetherchat.admin.data.AdminApi
import ru.tetherchat.admin.data.ApiException
import ru.tetherchat.admin.data.MessageReport
import ru.tetherchat.admin.data.SessionStore
import ru.tetherchat.admin.data.SiteBan

sealed class Screen {
  data object Login : Screen()
  data object Home : Screen()
  data object ActiveReports : Screen()
  data object History : Screen()
  data object Bans : Screen()
  data class Report(val id: String) : Screen()
  data class Ban(val id: String) : Screen()
}

class AdminViewModel(application: Application) : AndroidViewModel(application) {
  private val session = SessionStore.get(application)
  private val api = AdminApi(session)

  var screen by mutableStateOf<Screen>(if (session.hasSession) Screen.Home else Screen.Login)
    private set
  var error by mutableStateOf<String?>(null)
  var busy by mutableStateOf(false)
    private set
  var reports by mutableStateOf<List<MessageReport>>(emptyList())
    private set
  var bans by mutableStateOf<List<SiteBan>>(emptyList())
    private set
  var currentReport by mutableStateOf<MessageReport?>(null)
    private set
  var currentBan by mutableStateOf<SiteBan?>(null)
    private set

  fun login(login: String, password: String) {
    viewModelScope.launch {
      busy = true
      error = null
      runCatching { withContext(Dispatchers.IO) { api.login(login, password) } }
        .onSuccess { screen = Screen.Home }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  fun logout() {
    api.logout()
    reports = emptyList()
    bans = emptyList()
    currentReport = null
    currentBan = null
    screen = Screen.Login
  }

  fun back() {
    screen = when (screen) {
      is Screen.Report -> if (currentReport?.status == "pending") Screen.ActiveReports else Screen.History
      is Screen.Ban -> Screen.Bans
      Screen.ActiveReports, Screen.History, Screen.Bans -> Screen.Home
      else -> screen
    }
  }

  fun openActive() {
    screen = Screen.ActiveReports
    loadReports(pending = true)
  }

  fun openHistory() {
    screen = Screen.History
    loadReports(pending = false)
  }

  fun openBans() {
    screen = Screen.Bans
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.bans() } }
        .onSuccess { bans = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun openReport(id: String) {
    screen = Screen.Report(id)
    viewModelScope.launch {
      runCatching { withContext(Dispatchers.IO) { api.report(id) } }
        .onSuccess { currentReport = it }
        .onFailure { error = it.userMessage() }
    }
  }

  fun openBan(ban: SiteBan) {
    currentBan = ban
    screen = Screen.Ban(ban.id)
  }

  fun pardon() {
    val id = currentReport?.id ?: return
    viewModelScope.launch {
      busy = true
      runCatching { withContext(Dispatchers.IO) { api.pardon(id) } }
        .onSuccess {
          currentReport = it
          screen = Screen.ActiveReports
          loadReports(pending = true)
        }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  fun ban(hours: Int?, message: String) {
    val id = currentReport?.id ?: return
    viewModelScope.launch {
      busy = true
      runCatching { withContext(Dispatchers.IO) { api.ban(id, hours, message) } }
        .onSuccess {
          currentReport = it
          screen = Screen.ActiveReports
          loadReports(pending = true)
        }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  fun liftBan() {
    val id = currentBan?.id ?: return
    viewModelScope.launch {
      busy = true
      runCatching { withContext(Dispatchers.IO) { api.liftBan(id); api.bans() } }
        .onSuccess {
          bans = it
          currentBan = null
          screen = Screen.Bans
        }
        .onFailure { error = it.userMessage() }
      busy = false
    }
  }

  private fun loadReports(pending: Boolean) {
    viewModelScope.launch {
      runCatching {
        withContext(Dispatchers.IO) { if (pending) api.pendingReports() else api.closedReports() }
      }.onSuccess { reports = it }
        .onFailure { error = it.userMessage() }
    }
  }
}

private fun Throwable.userMessage(): String = (this as? ApiException)?.message ?: (message ?: "Ошибка")
