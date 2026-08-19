/** True when the page runs inside the TetherChat Android WebView. */
export function isNativeAndroidApp(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /\bTetherChatAndroid\b/.test(navigator.userAgent);
}

/** WebView wrapper or a TWA / installed PWA on Android — hide the APK download. */
export function isInstalledAndroidApp(): boolean {
  if (isNativeAndroidApp()) return true;
  if (typeof window === 'undefined') return false;
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  return standalone && /Android/i.test(navigator.userAgent);
}

/** Public path of the sideload APK served by the web container. */
export const ANDROID_APK_PATH = '/app/tetherchat.apk';
export const ANDROID_APK_FILENAME = 'TetherChat.apk';
