package ru.tetherchat.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.util.Size
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

@Composable
fun QrScannerScreen(model: AppViewModel) {
  val context = LocalContext.current
  val lifecycleOwner = LocalLifecycleOwner.current
  var hasCamera by remember {
    mutableStateOf(
      ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
    )
  }
  val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
    hasCamera = granted
    if (!granted) model.error = "Нужен доступ к камере для сканирования QR-кода"
  }

  DisposableEffect(Unit) {
    if (!hasCamera) permissionLauncher.launch(Manifest.permission.CAMERA)
    onDispose { }
  }

  val ticket = model.pendingQrTicket
  if (ticket != null) {
    AlertDialog(
      onDismissRequest = model::dismissQrLoginPrompt,
      title = { Text("Войти на компьютере?") },
      text = {
        Text(
          "Подтвердите вход в веб-версии TetherChat аккаунтом ${model.me?.label ?: "вашего профиля"}.",
        )
      },
      confirmButton = {
        TextButton(
          onClick = {
            model.approveQrLogin(ticket) { model.back() }
          },
          enabled = !model.busy,
        ) { Text("Подтвердить", color = Brand) }
      },
      dismissButton = {
        TextButton(onClick = model::dismissQrLoginPrompt) {
          Text("Отмена", color = TextMuted)
        }
      },
    )
  }

  Column(
    modifier = Modifier
      .fillMaxSize()
      .background(SurfaceDeep)
      .statusBarsPadding()
      .navigationBarsPadding(),
  ) {
    SettingsHeader("Сканер QR", model::back)
    Text(
      "Наведите камеру на QR-код на экране компьютера.",
      color = TextMuted,
      fontSize = 13.sp,
      modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
    Box(
      modifier = Modifier
        .fillMaxWidth()
        .weight(1f)
        .padding(16.dp)
        .background(SurfacePanel, androidx.compose.foundation.shape.RoundedCornerShape(16.dp)),
      contentAlignment = Alignment.Center,
    ) {
      if (!hasCamera) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
          Text("Разрешите доступ к камере", color = TextPrimary, textAlign = TextAlign.Center)
          Button(
            onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) },
            colors = ButtonDefaults.buttonColors(containerColor = Brand),
            modifier = Modifier.padding(top = 12.dp),
          ) { Text("Разрешить камеру") }
        }
      } else {
        val scanned = remember { mutableStateOf(false) }
        AndroidView(
          modifier = Modifier.fillMaxSize(),
          factory = { ctx ->
            PreviewView(ctx).apply {
              scaleType = PreviewView.ScaleType.FILL_CENTER
            }
          },
          update = { previewView ->
            if (scanned.value) return@AndroidView
            val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
            cameraProviderFuture.addListener({
              val cameraProvider = cameraProviderFuture.get()
              val preview = Preview.Builder().build().also {
                it.surfaceProvider = previewView.surfaceProvider
              }
              val analyzer = ImageAnalysis.Builder()
                .setTargetResolution(Size(1280, 720))
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
              val scanner = BarcodeScanning.getClient()
              val executor = Executors.newSingleThreadExecutor()
              analyzer.setAnalyzer(executor) { imageProxy ->
                if (scanned.value) {
                  imageProxy.close()
                  return@setAnalyzer
                }
                val mediaImage = imageProxy.image
                if (mediaImage == null) {
                  imageProxy.close()
                  return@setAnalyzer
                }
                val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
                scanner.process(image)
                  .addOnSuccessListener { barcodes ->
                    val raw = barcodes.firstOrNull { it.rawValue != null }?.rawValue
                    if (!raw.isNullOrBlank() && !scanned.value) {
                      scanned.value = true
                      previewView.post { model.onQrCodeScanned(raw) }
                    }
                  }
                  .addOnCompleteListener { imageProxy.close() }
              }
              cameraProvider.unbindAll()
              cameraProvider.bindToLifecycle(
                lifecycleOwner,
                CameraSelector.DEFAULT_BACK_CAMERA,
                preview,
                analyzer,
              )
            }, ContextCompat.getMainExecutor(context))
          },
        )
      }
    }
  }
}

@Composable
fun QrLoginPromptDialog(model: AppViewModel) {
  val ticket = model.pendingQrTicket ?: return
  if (model.screen is Screen.QrScanner) return
  AlertDialog(
    onDismissRequest = model::dismissQrLoginPrompt,
    title = { Text("Войти на компьютере?") },
    text = {
      Text(
        "Подтвердите вход в веб-версии TetherChat аккаунтом ${model.me?.label ?: "вашего профиля"}.",
      )
    },
    confirmButton = {
      TextButton(
        onClick = { model.approveQrLogin(ticket) },
        enabled = !model.busy,
      ) { Text("Подтвердить", color = Brand) }
    },
    dismissButton = {
      TextButton(onClick = model::dismissQrLoginPrompt) {
        Text("Отмена", color = TextMuted)
      }
    },
  )
}
