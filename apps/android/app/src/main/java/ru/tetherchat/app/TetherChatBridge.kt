package ru.tetherchat.app

import android.webkit.JavascriptInterface

/**
 * Called from the page when a message arrives and the WebView is not visible.
 * Android WebView cannot receive Web Push after the process is killed; this
 * covers the common case of the user pressing Home while the app is still alive.
 */
class TetherChatBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun notificationsAllowed(): Boolean = NotificationHelper.areEnabled(activity)

    @JavascriptInterface
    fun requestNotifications() {
        activity.runOnUiThread { activity.requestNotificationPermission() }
    }

    @JavascriptInterface
    fun showNotification(title: String?, body: String?, url: String?) {
        val safeTitle = title?.trim().orEmpty()
        val safeBody = body?.trim().orEmpty()
        val safeUrl = url?.trim().orEmpty().ifBlank { "/" }
        if (safeTitle.isEmpty() && safeBody.isEmpty()) {
            return
        }
        activity.runOnUiThread {
            NotificationHelper.notify(activity, safeTitle, safeBody, safeUrl)
        }
    }
}
