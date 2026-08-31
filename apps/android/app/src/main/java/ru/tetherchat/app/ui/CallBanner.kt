package ru.tetherchat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.tetherchat.app.data.CallPhase

@Composable
fun CallBanner(model: AppViewModel) {
  if (model.callPhase != CallPhase.Active || model.callUiExpanded) return
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(12.dp)
      .clip(RoundedCornerShape(18.dp))
      .background(SurfacePanel)
      .padding(horizontal = 12.dp, vertical = 10.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    Row(
      modifier = Modifier
        .weight(1f)
        .clickable(onClick = model::expandCall),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(Icons.Filled.Call, contentDescription = null, tint = Brand, modifier = Modifier.size(28.dp))
      Spacer(Modifier.width(10.dp))
      Column(Modifier.weight(1f)) {
        Text(
          model.callPeer?.label ?: "Текущий вызов",
          color = TextPrimary,
          fontWeight = FontWeight.SemiBold,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
        Text(callDuration(model.callConnectedAt), color = TextMuted, fontSize = 12.sp)
      }
    }
    IconButton(onClick = model::toggleCallMute, modifier = Modifier.size(42.dp)) {
      Icon(
        if (model.callMuted) Icons.Filled.MicOff else Icons.Filled.Mic,
        contentDescription = if (model.callMuted) "Включить микрофон" else "Выключить микрофон",
        tint = TextPrimary,
      )
    }
    IconButton(onClick = model::endActiveCall, modifier = Modifier.size(42.dp)) {
      Icon(Icons.Filled.CallEnd, contentDescription = "Завершить", tint = Danger)
    }
  }
}
