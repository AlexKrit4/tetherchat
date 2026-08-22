/** Keep in sync with apps/android versionCode/versionName and public/app/version.json. */
export const ANDROID_RELEASE = {
  versionCode: 21,
  versionName: '1.2.13',
  url: 'https://tetherchat.ru/app/tetherchat.apk',
  requiresReinstall: true,
  releaseNotes:
    'Разделители дат в чате (Сегодня, Вчера, 22 августа). Это обновление требует удаления старой версии приложения.',
} as const;
