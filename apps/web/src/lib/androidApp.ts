/** True when the page runs inside the TetherChat Android WebView. */
export function isNativeAndroidApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /\bTetherChatAndroid\b/.test(navigator.userAgent);
}

/** Public path of the sideload APK served by the web container. */
export const ANDROID_APK_PATH = '/app/tetherchat.apk';
export const ANDROID_APK_FILENAME = 'TetherChat.apk';
