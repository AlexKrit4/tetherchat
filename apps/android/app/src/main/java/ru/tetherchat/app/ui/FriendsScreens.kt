package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.tetherchat.app.data.FriendRequest

@Composable
fun IncomingFriendsScreen(model: AppViewModel) {
  LaunchedEffect(Unit) { model.refreshIncomingFriends() }
  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    SettingsHeader("Заявки в друзья", model::back)
    if (model.incomingFriends.isEmpty()) {
      Text(
        "Пока никто не отправил заявку",
        color = TextMuted,
        modifier = Modifier.fillMaxWidth().padding(24.dp),
      )
    } else {
      LazyColumn {
        items(model.incomingFriends, key = { it.id }) { request ->
          FriendRequestRow(model, request)
        }
      }
    }
  }
}

@Composable
private fun FriendRequestRow(model: AppViewModel, request: FriendRequest) {
  Row(
    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    UserAvatar(request.from, 40.dp, model.statusOf(request.from.id, request.from.status))
    Spacer(Modifier.width(12.dp))
    Column(Modifier.weight(1f)) {
      PlusName(request.from, fontWeight = FontWeight.Medium, fontSize = 16.sp)
      Text("@${request.from.username}", color = TextMuted, fontSize = 13.sp)
    }
    IconButton(onClick = { model.declineFriend(request) }) {
      Box(
        Modifier.size(36.dp).clip(CircleShape).background(Danger),
        contentAlignment = Alignment.Center,
      ) {
        Icon(Icons.Outlined.Close, contentDescription = "Отклонить", tint = Color.White)
      }
    }
    IconButton(onClick = { model.acceptFriend(request) }) {
      Box(
        Modifier.size(36.dp).clip(CircleShape).background(Online),
        contentAlignment = Alignment.Center,
      ) {
        Icon(Icons.Outlined.Check, contentDescription = "Принять", tint = Color.White)
      }
    }
  }
}

@Composable
fun FriendBadge(count: Int) {
  if (count <= 0) return
  Box(
    modifier = Modifier
      .size(18.dp)
      .clip(CircleShape)
      .background(Danger),
    contentAlignment = Alignment.Center,
  ) {
    Text(
      if (count > 9) "9+" else count.toString(),
      color = Color.White,
      fontSize = 10.sp,
      fontWeight = FontWeight.Bold,
    )
  }
}
