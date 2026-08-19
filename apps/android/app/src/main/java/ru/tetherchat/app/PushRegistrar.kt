package ru.tetherchat.app

import android.app.Application
import android.content.Context
import android.os.Handler
import android.os.Looper
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import ru.tetherchat.app.data.SessionStore
import ru.tetherchat.app.data.TetherApi

object PushRegistrar {
  private val lock = Any()

  fun init(app: Application) {
    Thread {
      val ready = synchronized(lock) {
        if (FirebaseApp.getApps(app).isNotEmpty()) true
        else {
          val config = runCatching { TetherApi(SessionStore.get(app)).fcmConfig() }.getOrNull()
          if (config == null || !config.ready) false
          else runCatching {
            FirebaseApp.initializeApp(
              app,
              FirebaseOptions.Builder()
                .setProjectId(config.projectId)
                .setApplicationId(config.applicationId)
                .setApiKey(config.apiKey)
                .setGcmSenderId(config.senderId)
                .build(),
            )
          }.isSuccess
        }
      }
      if (ready) Handler(Looper.getMainLooper()).post { sync(app) }
    }.start()
  }

  fun sync(context: Context) {
    val appContext = context.applicationContext
    if (FirebaseApp.getApps(appContext).isEmpty()) {
      if (appContext is Application) init(appContext)
      return
    }
    val session = SessionStore.get(appContext)
    if (!session.hasSession) return
    FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
      if (token.isNullOrBlank()) return@addOnSuccessListener
      session.fcmToken = token
      Thread {
        runCatching { TetherApi(session).subscribeFcm(token) }
      }.start()
    }
  }

  fun unregister(context: Context) {
    val session = SessionStore.get(context)
    val token = session.fcmToken ?: return
    if (!session.hasSession) return
    runCatching { TetherApi(session).unsubscribeFcm(token) }
    session.fcmToken = null
  }
}
