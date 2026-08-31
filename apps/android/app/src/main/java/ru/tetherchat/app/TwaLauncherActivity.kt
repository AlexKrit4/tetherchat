package ru.tetherchat.app

import android.content.Intent
import com.google.androidbrowserhelper.trusted.LauncherActivity
import com.google.androidbrowserhelper.trusted.TwaLauncher

/**
 * Chrome Trusted Web Activity is what actually receives Web Push when the app
 * is not running. If Chrome (or another TWA provider) is missing, we open the
 * in-process WebView instead of a Custom Tab with an address bar.
 */
class TwaLauncherActivity : LauncherActivity() {
    override fun getFallbackStrategy(): TwaLauncher.FallbackStrategy {
        return TwaLauncher.FallbackStrategy { context, builder, _, completionCallback ->
            context.startActivity(
                Intent(context, MainActivity::class.java).apply {
                    data = builder.uri
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                },
            )
            completionCallback?.run()
        }
    }
}
