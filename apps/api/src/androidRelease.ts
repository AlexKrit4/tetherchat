/** Keep in sync with apps/android versionCode/versionName and public/app/version.json. */
export const ANDROID_RELEASE = {
  versionCode: 29,
  versionName: '1.2.21',
  url: 'https://tetherchat.ru/app/tetherchat.apk',
  requiresReinstall: false,
  releaseNotes:
    'Исправлены кнопки «Принять» и «Отклонить» в уведомлении входящего звонка.',
} as const;
