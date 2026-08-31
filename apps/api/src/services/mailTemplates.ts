import { getConfig } from '../config.js';

function layout(title: string, body: string, buttonLabel: string, buttonUrl: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#111214;color:#dbdee1;font-family:Segoe UI,Roboto,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto">
    <tr><td style="padding:24px;background:#1e1f22;border-radius:12px;border:1px solid #2b2d31">
      <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#949ba4">TetherChat</p>
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#f2f3f5">${title}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#b5bac1">${body}</p>
      <a href="${buttonUrl}" style="display:inline-block;padding:12px 20px;background:#5865f2;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">${buttonLabel}</a>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:#949ba4">${footer}</p>
      <p style="margin:12px 0 0;font-size:11px;line-height:1.5;color:#6d7178;word-break:break-all">${buttonUrl}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export function verificationEmail(url: string) {
  const subject = 'Подтвердите почту в TetherChat';
  const text =
    `Подтвердите адрес электронной почты в TetherChat.\n\n` +
    `Перейдите по ссылке:\n${url}\n\n` +
    `Ссылка действует 24 часа. После подтверждения можно будет восстановить пароль по почте.`;
  const html = layout(
    'Подтвердите почту',
    'Нажмите кнопку ниже, чтобы подтвердить адрес. Это нужно для восстановления пароля и безопасности аккаунта.',
    'Подтвердить почту',
    url,
    'Если вы не регистрировались в TetherChat, просто проигнорируйте это письмо.',
  );
  return { subject, text, html };
}

export function passwordResetEmail(url: string) {
  const subject = 'Сброс пароля TetherChat';
  const text =
    `Вы запросили сброс пароля в TetherChat.\n\n` +
    `Перейдите по ссылке:\n${url}\n\n` +
    `Ссылка действует 1 час. Если это были не вы, проигнорируйте письмо.`;
  const html = layout(
    'Сброс пароля',
    'Нажмите кнопку ниже, чтобы задать новый пароль. После смены пароля все активные сессии будут завершены.',
    'Сбросить пароль',
    url,
    'Если вы не запрашивали сброс, ничего делать не нужно — пароль останется прежним.',
  );
  return { subject, text, html };
}

export function authLink(path: string, token: string): string {
  const origin = getConfig().PUBLIC_WEB_ORIGIN.replace(/\/$/, '');
  return `${origin}${path}?token=${encodeURIComponent(token)}`;
}
