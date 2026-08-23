package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.CallEnd
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.tetherchat.app.data.CallPhase

@Composable
fun CallOverlay(model: AppViewModel) {
  val phase = model.callPhase
  if (phase == CallPhase.Idle && model.callError == null) return

  val label = when (phase) {
    CallPhase.Outgoing -> "Звоним…"
    CallPhase.Ringing -> "Входящий звонок"
    CallPhase.Connecting -> "Подключение…"
    CallPhase.Active -> "Разговор"
    CallPhase.Idle -> "Звонок завершён"
  }

  Box(
    Modifier
      .fillMaxSize()
      .background(SurfaceDeep.copy(alpha = 0.92f)),
    contentAlignment = Alignment.Center,
  ) {
    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      modifier = Modifier.padding(24.dp),
    ) {
      Box(
        Modifier
          .size(88.dp)
          .clip(CircleShape)
          .background(SurfaceRaised),
        contentAlignment = Alignment.Center,
      ) {
        Icon(Icons.Filled.Call, contentDescription = null, tint = Brand, modifier = Modifier.size(36.dp))
      }
      Spacer(Modifier.height(16.dp))
      Text(
        model.callPeer?.label ?: "Контакт",
        color = TextPrimary,
        fontSize = 22.sp,
        fontWeight = FontWeight.SemiBold,
        textAlign = TextAlign.Center,
      )
      Spacer(Modifier.height(8.dp))
      Text(
        model.callError ?: label,
        color = TextMuted,
        fontSize = 14.sp,
        textAlign = TextAlign.Center,
      )
      Spacer(Modifier.height(28.dp))

      if (phase == CallPhase.Ringing) {
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
          IconButton(
            onClick = model::declineIncomingCall,
            modifier = Modifier
              .size(56.dp)
              .clip(CircleShape)
              .background(Danger),
          ) {
            Icon(Icons.Filled.CallEnd, contentDescription = "Отклонить", tint = TextPrimary)
          }
          IconButton(
            onClick = model::acceptIncomingCall,
            modifier = Modifier
              .size(56.dp)
              .clip(CircleShape)
              .background(Brand),
          ) {
            Icon(Icons.Filled.Call, contentDescription = "Принять", tint = TextPrimary)
          }
        }
      } else {
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
          if (phase == CallPhase.Active) {
            IconButton(
              onClick = model::toggleCallMute,
              modifier = Modifier
                .size(48.dp)
                .clip(CircleShape)
                .background(SurfaceRaised),
            ) {
              Icon(
                if (model.callMuted) Icons.Filled.MicOff else Icons.Filled.Mic,
                contentDescription = if (model.callMuted) "Включить микрофон" else "Выключить микрофон",
                tint = TextPrimary,
              )
            }
          }
          IconButton(
            onClick = model::endActiveCall,
            modifier = Modifier
              .size(56.dp)
              .clip(CircleShape)
              .background(Danger),
          ) {
            Icon(Icons.Filled.CallEnd, contentDescription = "Завершить", tint = TextPrimary)
          }
        }
      }
    }
  }
}
