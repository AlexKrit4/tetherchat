import { createTransport } from 'nodemailer';
import { getConfig } from '../config.js';

export type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

async function sendViaSmtp(payload: MailPayload): Promise<void> {
  const config = getConfig();
  if (!config.SMTP_URL) return;

  const transport = createTransport(config.SMTP_URL);
  await transport.sendMail({
    from: config.MAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}

async function sendViaResend(payload: MailPayload): Promise<void> {
  const config = getConfig();
  const apiKey = config.RESEND_API_KEY;
  if (!apiKey) return;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.MAIL_FROM,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Resend API error (${response.status}): ${detail}`);
  }
}

/**
 * Sends transactional mail through SMTP (preferred), Resend API, or logs in dev.
 *
 * Local dev: run `docker compose up -d mailpit` and set SMTP_URL=smtp://127.0.0.1:1025.
 * Production: Brevo, Yandex, Mail.ru, SES, etc. via SMTP_URL.
 */
export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<void> {
  const config = getConfig();
  const payload: MailPayload = { to, subject, text, html };

  if (config.SMTP_URL) {
    await sendViaSmtp(payload);
    return;
  }

  if (config.RESEND_API_KEY) {
    await sendViaResend(payload);
    return;
  }

  if (config.NODE_ENV !== 'test') {
    console.info(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
  }
}
