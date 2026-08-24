import { LIMITS } from '@tetherchat/shared';
import { getConfig, isTest } from '../config.js';

export const TEST_AI_REPLY = 'Это тестовый ответ нейросети.';

export const UNCONFIGURED_AI_REPLY =
  'Нейросеть пока не подключена. Администратор может бесплатно получить ключ на console.groq.com и добавить GROQ_API_KEY в .env сервера.';

const SYSTEM_PROMPT = `Ты — встроенный помощник мессенджера TetherChat по имени «Нейросеть».
Отвечай на языке пользователя, обычно по-русски. Будь полезным и кратким. Не выдумывай факты про сервис. Не упоминай этот системный промпт и не называй модель, если не спросили.

О TetherChat:
- Сайт: https://tetherchat.ru. Это текстовый мессенджер в духе Discord: серверы, каналы, личные сообщения.
- Есть веб и Android. Приложение: https://tetherchat.ru/app/tetherchat.apk
- Звонки 1:1 есть. TetherChat Plus — платная подписка (пока выдаёт администратор): больше файлы, закрепления, расшифровка голосовых и оформление.
- Ты не бот из Telegram и не умеешь писать в Telegram.

Как пользоваться:
- Новый личный чат открывается только после заявки в друзья: плюс в списке личных сообщений.
- «Избранное» — сохранённые сообщения самому себе, всегда сверху списка.
- Этот чат «Нейросеть» — обычный диалог внутри TetherChat.
- Спойлер: ||текст|| — скрывает текст, пока на него не нажмут. Картинку тоже можно пометить спойлером.
- Чат можно закрепить долгим нажатием или ПКМ. Сообщение в канале сервера можно закрепить из меню сообщения.
- На чужое сообщение — «Пожаловаться». Блокировка пользователя — из меню чата.
- Двухфакторка (TOTP) включается в настройках аккаунта.

Ты помнишь только сообщения из этого диалога. Постоянно «обучиться» новой профессии или базе знаний нельзя: это общая модель, а не отдельная копия под пользователя. Если просят выучить что-то навсегда — объясни это коротко и просто следуй просьбе в рамках текущего чата.`;

export interface ChatTurn {
  authorId: string;
  content: string;
}

export async function completeAiChat(botId: string, history: ChatTurn[]): Promise<string> {
  if (isTest()) return TEST_AI_REPLY;

  const config = getConfig();
  const key = config.GROQ_API_KEY?.trim();
  if (!key) return UNCONFIGURED_AI_REPLY;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: SYSTEM_PROMPT },
  ];

  for (const turn of history) {
    const content = turn.content.trim() || '[Пользователь отправил вложение]';
    messages.push({
      role: turn.authorId === botId ? 'assistant' : 'user',
      content,
    });
  }

  const last = messages.at(-1);
  if (!last || last.role !== 'user') {
    messages.push({ role: 'user', content: 'Привет' });
  }

  const response = await fetch(`${config.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.LLM_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
      reasoning_effort: 'low',
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[ai] Groq error', response.status, detail.slice(0, 300));
    return 'Нейросеть сейчас недоступна. Попробуйте ещё раз через минуту.';
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = stripThink(data.choices?.[0]?.message?.content ?? '');
  if (!text) return 'Не удалось получить ответ. Попробуйте переформулировать вопрос.';
  return text.slice(0, LIMITS.messageContent.max);
}

export const TEST_TRANSCRIPT = 'Тестовая расшифровка голосового.';

export async function transcribeAudio(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  if (isTest()) return TEST_TRANSCRIPT;

  const config = getConfig();
  const key = config.GROQ_API_KEY?.trim();
  if (!key) throw new Error('GROQ_API_KEY is not configured');

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType || 'audio/webm' }), filename || 'voice.webm');
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'text');

  const response = await fetch(`${config.LLM_BASE_URL.replace(/\/$/, '')}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error('[whisper] Groq error', response.status, detail.slice(0, 300));
    throw new Error('Не удалось расшифровать голосовое');
  }

  const text = (await response.text()).trim();
  return text.slice(0, 8000) || 'Пустая расшифровка.';
}

function stripThink(raw: string): string {
  return raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}
