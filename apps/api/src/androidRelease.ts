/** Keep in sync with apps/android versionCode/versionName and public/app/version.json. */
export const ANDROID_RELEASE = {
  versionCode: 31,
  versionName: '1.3.1',
  url: 'https://tetherchat.ru/app/tetherchat.apk',
  requiresReinstall: false,
  releaseNotes:
    'Исправлена отправка секретных сообщений; добавлена отдельная вкладка друзей и новый выбор по кнопке «+».',
} as const;
