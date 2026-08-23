/** Keep in sync with apps/android versionCode/versionName and public/app/version.json. */
export const ANDROID_RELEASE = {
  versionCode: 30,
  versionName: '1.3.0',
  url: 'https://tetherchat.ru/app/tetherchat.apk',
  requiresReinstall: false,
  releaseNotes:
    'Список друзей и секретные E2EE-чаты с ключами только на устройствах собеседников.',
} as const;
