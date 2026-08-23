/** Keep in sync with apps/android versionCode/versionName and public/app/version.json. */
export const ANDROID_RELEASE = {
  versionCode: 26,
  versionName: '1.2.18',
  url: 'https://tetherchat.ru/app/tetherchat.apk',
  requiresReinstall: false,
  releaseNotes:
    'Запрос доступа к микрофону перед звонком, автосброс зависших звонков, совместимость LiveKit.',
} as const;
