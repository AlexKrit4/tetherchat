# TetherChat

Мессенджер для команд и друзей — текстовый, с интерфейсом в стиле Discord.
Работает одинаково на мониторе 1920×1080 и на телефоне: на десктопе это
привычные четыре колонки, на телефоне — один экран за раз с навигацией назад,
как в мобильном приложении.

Домен: **tetherchat.ru**

```
┌──────┬─────────────┬──────────────────────────┬─────────────┐   ┌──────────────┐
│Server│  Channels   │        Messages          │   Members   │   │   Messages   │
│ 72px │   240px     │          flex            │   240px     │   │  один экран  │
└──────┴─────────────┴──────────────────────────┴─────────────┘   └──────────────┘
                    ≥1024px                                          <768px
```

## Быстрый старт

Нужны Node.js 20+ и Docker.

```bash
git clone <repo> tetherchat && cd tetherchat
cp .env.example .env                # задайте JWT-секреты
npm install

docker compose up -d                # postgres, redis, minio
npm run db:deploy                   # миграции
npm run db:seed                     # демо-сервер «Friendos»

npm run dev                         # api :4000 + web :5173
```

Откройте http://localhost:5173 и войдите:

| Логин    | Пароль       | Роль                     |
| -------- | ------------ | ------------------------ |
| `hoods`  | `tetherchat` | владелец, Fearless Leader |
| `wumpus` | `tetherchat` | модератор                |
| `phibi`  | `tetherchat` | участник                 |

Остальные демо-аккаунты: `chad`, `mallow`, `face` — тот же пароль. Чтобы
посмотреть realtime, войдите двумя аккаунтами в разных окнах.

Без Docker: поднимите Postgres 16 и Redis 7 сами и укажите `DATABASE_URL` и
`REDIS_URL` в `.env`. Файлы тогда пишутся на диск (`STORAGE_DRIVER=local`).

## Архитектура

```
tetherchat/
├── apps/
│   ├── api/                  Fastify + Prisma + Socket.io
│   │   ├── prisma/           schema.prisma, миграции, seed
│   │   └── src/
│   │       ├── routes/       auth, users, servers, channels, messages, dms, invites, upload, push
│   │       ├── services/     messageService, serverService, readState, push, linkPreview, mail
│   │       ├── ws/           socket.io: сообщения, typing, presence
│   │       ├── jobs/         BullMQ: превью ссылок, push, письма
│   │       └── lib/          permissions, tokens, storage, serialize
│   └── web/                  React 18 + Vite + Tailwind + PWA
│       └── src/
│           ├── components/
│           │   ├── layout/   AppShell, DesktopLayout, TabletLayout, MobileLayout, ServerRail…
│           │   ├── mobile/   экраны мобильного стека
│           │   ├── chat/     MessageList, MessageGroup, MessageInput, MessageActionSheet…
│           │   ├── modals/   диалоги (модалка на десктопе, bottom sheet на телефоне)
│           │   ├── settings/ настройки, общие для обоих раскладок
│           │   └── ui/       Button, IconButton, Input, Avatar, BottomSheet, Modal, ContextMenu…
│           ├── hooks/        useMediaQuery, useMobileKeyboard, useLongPress, useSwipeBack…
│           ├── stores/       auth, ui (mobileView), presence, typing, toasts
│           └── styles/       tokens.css — все цвета проекта
├── packages/shared/          типы, битовая маска прав, группировка сообщений, парсинг упоминаний
├── e2e/                      Playwright: desktop 1440×900 и mobile 390×844
├── nginx/                    edge-конфиг для tetherchat.ru и конфиг SPA-контейнера
├── docker-compose.yml        dev: базы данных
└── docker-compose.prod.yml   prod: весь продукт
```

Три уровня: SPA → REST/WebSocket API → PostgreSQL и Redis. Redis хранит сессии
presence, счётчики rate limit, очереди BullMQ и служит адаптером socket.io,
поэтому API масштабируется в несколько инстансов.

## Что умеет

**Аккаунты.** Регистрация, вход по email или username, JWT access-токен на 15
минут и refresh-токен на 7 дней в httpOnly-cookie с ротацией при каждом
обновлении. Подтверждение email и восстановление пароля.

**Серверы и каналы.** Создание серверов, категории, текстовые каналы, темы
каналов, инвайты вида `tetherchat.ru/invite/<code>` с лимитом использований и
сроком жизни. Голосовых каналов нет — это текстовый мессенджер.

**Сообщения.** Realtime через WebSocket с оптимистичной отправкой и откатом при
ошибке, REST как запасной путь при обрыве связи. Markdown (**жирный**,
*курсив*, `код`, блоки кода, цитаты, списки), упоминания `@user`, `#канал` и
`@everyone` с автодополнением, ответы, редактирование, удаление, реакции,
закреплённые сообщения, вложения до 10 МБ, превью ссылок, индикатор набора
текста, разделитель непрочитанного, бесконечная прокрутка истории и поиск по
каналу.

**Права.** Битовая маска на 13 прав, роли с цветами и порядком, права на уровне
канала, иерархия ролей: нельзя выдать право, которого нет у вас самих, и нельзя
действовать против того, чья роль выше. Кик, бан, разбан.

**Личные сообщения.** Диалоги один на один и группы до 10 человек.

**Уведомления.** Счётчики непрочитанного, подсветка упоминаний, настройка на
каждый канал (все / только упоминания / ничего) и Web Push через service worker.

**PWA.** Устанавливается на домашний экран, работает в standalone-режиме, шелл
кэшируется, обновление предлагается кнопкой, а не перезагружает страницу под
руками.

## Мобильная и десктопная раскладки

`AppShell` выбирает раскладку по ширине окна:

| Ширина       | Раскладка   | Что видно                                                   |
| ------------ | ----------- | ----------------------------------------------------------- |
| < 768px      | `MobileLayout`  | один экран: серверы → каналы → чат, назад по стеку и свайпом |
| 768–1023px   | `TabletLayout`  | три колонки, участники выезжают поверх чата                  |
| ≥ 1024px     | `DesktopLayout` | четыре колонки: 72 / 240 / flex / 240                        |

Что сделано специально для телефона:

- высота считается в `100dvh`, а не `100vh`, иначе адресная строка съедает экран;
- отступы учитывают `env(safe-area-inset-*)` — вырез и полоса домой на iPhone;
- поле ввода поднимается над клавиатурой по данным `visualViewport`;
- Enter переносит строку, отправка — отдельной кнопкой (на десктопе наоборот,
  Enter отправляет, Shift+Enter переносит; переключается в настройках);
- действия с сообщением — долгое нажатие и bottom sheet вместо hover-панели;
- диалоги превращаются в bottom sheet, контекстные меню тоже;
- все интерактивные элементы не меньше 44×44px;
- горизонтальной прокрутки нет ни при 320px, ни при повороте экрана.

## Дизайн

Все цвета живут в `apps/web/src/styles/tokens.css` и попадают в Tailwind как
именованные токены; палитра Tailwind по умолчанию отключена, чтобы случайный
`bg-slate-800` не сломал иерархию поверхностей. Глубина задаётся только слоями
фона — `#1e1f22` → `#2b2d31` → `#313338` — без рамок и без свечения. Тени есть
только у того, что действительно висит над интерфейсом: модалки, шиты,
контекстные меню, тултипы.

Тема одна, тёмная. Светлую можно добавить, переопределив переменные в `:root`,
не трогая компоненты.

## Команды

```bash
npm run dev            # api + web в watch-режиме
npm run build          # shared → api → web
npm run typecheck      # tsc по всем воркспейсам
npm run lint           # eslint
npm run format         # prettier

npm run db:migrate     # создать миграцию (dev)
npm run db:deploy      # применить миграции (prod)
npm run db:seed        # демо-данные «Friendos»
npm run db:reset       # сбросить базу
npm run db:studio      # Prisma Studio

npm test               # shared + api + web
npm run test:e2e       # Playwright: seed + desktop + mobile
```

Тесты API работают с настоящими Postgres и Redis: они проверяют ровно то, что
живёт в слое данных — каскады, уникальные ограничения, разрешение прав.
Отдельная база задаётся через `TEST_DATABASE_URL`.

## Деплой на tetherchat.ru

1. DNS: `A`-запись `tetherchat.ru` и `www.tetherchat.ru` на IP сервера.

2. `.env` на сервере:

   ```bash
   NODE_ENV=production
   JWT_ACCESS_SECRET=$(openssl rand -base64 48)
   JWT_REFRESH_SECRET=$(openssl rand -base64 48)
   POSTGRES_PASSWORD=<длинный пароль>
   PUBLIC_WEB_ORIGIN=https://tetherchat.ru
   PUBLIC_API_ORIGIN=https://tetherchat.ru
   COOKIE_DOMAIN=.tetherchat.ru
   COOKIE_SECURE=true
   S3_PUBLIC_URL=https://tetherchat.ru/files
   ```

   Ключи для Web Push: `npx web-push generate-vapid-keys` → `VAPID_PUBLIC_KEY`
   и `VAPID_PRIVATE_KEY`.

3. Стек поднимается по HTTP сразу (`nginx/tetherchat.ru.http.conf`). Когда DNS
   уже смотрит на сервер, выпустите сертификаты и переключите edge на TLS:

   ```bash
   mkdir -p letsencrypt certbot-www
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose -f docker-compose.prod.yml exec api ../../node_modules/.bin/tsx prisma/seed.ts

   docker compose -f docker-compose.prod.yml stop edge
   docker compose -f docker-compose.prod.yml --profile certs run --rm --service-ports certbot \
     certonly --standalone --agree-tos -m admin@tetherchat.ru \
     -d tetherchat.ru -d www.tetherchat.ru
   NGINX_EDGE_CONF=./nginx/tetherchat.ru.conf docker compose -f docker-compose.prod.yml up -d edge
   ```

Контейнер `api` сам применяет миграции при старте. Edge-nginx терминирует TLS,
отдаёт SPA, проксирует `/api`, апгрейдит `/socket.io` до WebSocket и раздаёт
`/files` из MinIO. Тело запроса ограничено 12 МБ — вложения по 10 МБ плюс
запас на конверт.

Проверка живости: `GET /api/health`.

## Android-приложение

APK скачивается из **Настройки пользователя → Мой профиль → Скачать APK**
(https://tetherchat.ru/app/tetherchat.apk).

Исходники Android Studio — в `apps/android`. Это оболочка WebView над сайтом:
тот же дизайн и тот же функционал. Сборка: `./gradlew assembleDebug`, затем
скопируйте APK в `apps/web/public/app/tetherchat.apk`. Подробности — в
[apps/android/README.md](apps/android/README.md).

Язык интерфейса по умолчанию — **русский**. Английский включается в Настройки → Оформление.

## Переменные окружения

Полный список с комментариями — в [`.env.example`](.env.example). Ключевое:

| Переменная                            | Назначение                                                |
| ------------------------------------- | --------------------------------------------------------- |
| `DATABASE_URL`, `REDIS_URL`           | подключения к БД                                          |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | подпись токенов, минимум 16 символов                  |
| `PUBLIC_WEB_ORIGIN`, `PUBLIC_API_ORIGIN` | CORS, cookie и ссылки в письмах                        |
| `COOKIE_SECURE`, `COOKIE_DOMAIN`      | refresh-cookie в проде                                    |
| `STORAGE_DRIVER`                      | `local` или `s3` (MinIO и совместимые)                    |
| `VAPID_*`                             | Web Push; без них push просто выключен                    |
| `SMTP_URL`                            | письма; без него они пишутся в лог                        |
| `MESSAGE_RATE_PER_10S`                | лимит отправки сообщений на пользователя                  |

## Безопасность

Пароли — bcrypt с 12 раундами. Refresh-токены хранятся только как SHA-256 и
ротируются при каждом обновлении, так что украденная копия живёт до первого
обновления настоящим клиентом. Сброс пароля завершает все сессии.
`/api/auth/forgot-password` всегда отвечает `202`, чтобы по нему нельзя было
перебирать аккаунты. Markdown рендерится без raw HTML, ссылки получают
`rel="noopener noreferrer nofollow"`. Загрузки ограничены по размеру и типу,
аватары пересобираются через sharp, что заодно снимает метаданные. Сборщик
превью ссылок не ходит на localhost и в приватные диапазоны адресов. Права
проверяются на каждом запросе на сервере — интерфейс лишь прячет то, на что нет
доступа.

## Лицензия

MIT.
