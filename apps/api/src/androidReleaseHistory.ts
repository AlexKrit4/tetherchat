/** Keep in sync with apps/web/public/app/version-history.json */
export const APP_CREATOR = 'alexkrit';

export type VersionHistoryEntry = {
  versionCode: number;
  versionName: string;
  releaseNotes: string;
  releasedAt: string;
  requiresReinstall?: boolean;
};

export const ANDROID_RELEASE_HISTORY: VersionHistoryEntry[] = [
  {
    versionCode: 36,
    versionName: '1.4.3',
    releasedAt: '2026-08-26',
    releaseNotes:
      'В настройках появился раздел «О приложении»: версия, создатель alexkrit и история всех обновлений.',
  },
  {
    versionCode: 35,
    versionName: '1.4.2',
    releasedAt: '2026-08-26',
    releaseNotes:
      'Кликабельные ссылки в сообщениях. Секретные чаты привязаны к одному устройству — чат виден только на том телефоне/ПК, где вы его впервые открыли.',
  },
  {
    versionCode: 34,
    versionName: '1.4.1',
    releasedAt: '2026-08-24',
    releaseNotes:
      'Enigma VPN бот: тарифы как на bigwinzone, кнопки управления в чате, можно писать боту без добавления в друзья.',
  },
  {
    versionCode: 33,
    versionName: '1.4.0',
    releasedAt: '2026-08-24',
    releaseNotes:
      'TetherChat Plus: файлы 30 МБ, 10 закрепов, био 500, транскрипт голосовых, скрытие last seen, защита секретных чатов, два аккаунта, фон чата и набор иконок.',
  },
  {
    versionCode: 32,
    versionName: '1.3.2',
    releasedAt: '2026-08-24',
    releaseNotes:
      'В профиле незнакомого пользователя — «Добавить в друзья» вместо «Написать». ЛС и звонки только между друзьями.',
  },
  {
    versionCode: 31,
    versionName: '1.3.1',
    releasedAt: '2026-08-23',
    releaseNotes:
      'Исправлена отправка секретных сообщений; добавлена отдельная вкладка друзей и новый выбор по кнопке «+».',
  },
  {
    versionCode: 30,
    versionName: '1.3.0',
    releasedAt: '2026-08-23',
    releaseNotes: 'Список друзей и секретные E2EE-чаты с ключами только на устройствах собеседников.',
  },
  {
    versionCode: 29,
    versionName: '1.2.21',
    releasedAt: '2026-08-23',
    releaseNotes: 'Исправлены кнопки «Принять» и «Отклонить» в уведомлении входящего звонка.',
  },
  {
    versionCode: 28,
    versionName: '1.2.20',
    releasedAt: '2026-08-23',
    releaseNotes:
      'Таймер звонка, сворачивание в мини-плашку, управление звонком из уведомления и выбор динамика.',
  },
  {
    versionCode: 27,
    versionName: '1.2.19',
    releasedAt: '2026-08-23',
    releaseNotes: 'Исправлено двустороннее аудио в звонках: микрофон и динамик на Android, звук в браузере.',
  },
  {
    versionCode: 26,
    versionName: '1.2.18',
    releasedAt: '2026-08-23',
    releaseNotes:
      'Запрос доступа к микрофону перед звонком, автосброс зависших звонков, совместимость LiveKit.',
  },
  {
    versionCode: 25,
    versionName: '1.2.17',
    releasedAt: '2026-08-23',
    releaseNotes:
      'Голосовые звонки 1:1 в личных DM через LiveKit. Кнопка «Позвонить» в шапке чата, входящий звонок с уведомлением Accept/Decline.',
  },
  {
    versionCode: 24,
    versionName: '1.2.16',
    releasedAt: '2026-08-22',
    releaseNotes: 'Плашка «Сегодня» и другие даты теперь показываются над сообщениями, а не под ними.',
  },
  {
    versionCode: 23,
    versionName: '1.2.15',
    releasedAt: '2026-08-22',
    releaseNotes:
      'Сообщения одного автора в течение 5 минут группируются без повторения аватарки, ника и времени.',
  },
  {
    versionCode: 22,
    versionName: '1.2.14',
    releasedAt: '2026-08-22',
    releaseNotes: 'Вход на компьютер по QR-коду из настроек → Сессии.',
  },
  {
    versionCode: 21,
    versionName: '1.2.13',
    releasedAt: '2026-08-22',
    requiresReinstall: true,
    releaseNotes:
      'Разделители дат в чате (Сегодня, Вчера, 22 августа). Это обновление требует удаления старой версии приложения.',
  },
  {
    versionCode: 20,
    versionName: '1.2.12',
    releasedAt: '2026-08-22',
    releaseNotes: 'Разделители дат в чате (Сегодня, Вчера, конкретные даты).',
  },
];
