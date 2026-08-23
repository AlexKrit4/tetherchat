/** Keep in sync with apps/android versionCode/versionName and public/app/version.json. */
export const ANDROID_RELEASE = {
  versionCode: 27,
  versionName: '1.2.19',
  url: 'https://tetherchat.ru/app/tetherchat.apk',
  requiresReinstall: false,
  releaseNotes:
    'Исправлено двустороннее аудио в звонках: микрофон и динамик на Android, звук в браузере.',
} as const;
