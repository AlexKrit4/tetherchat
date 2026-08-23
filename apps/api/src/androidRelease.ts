/** Keep in sync with apps/android versionCode/versionName and public/app/version.json. */
export const ANDROID_RELEASE = {
  versionCode: 25,
  versionName: '1.2.17',
  url: 'https://tetherchat.ru/app/tetherchat.apk',
  requiresReinstall: false,
  releaseNotes:
    'Голосовые звонки 1:1 в личных DM через LiveKit. Кнопка «Позвонить» в шапке чата, входящий звонок с уведомлением Accept/Decline.',
} as const;
