import { createTransport } from 'nodemailer';
import { getConfig } from '../config.js';

/**
 * Without SMTP_URL configured the message is logged instead of sent, which keeps
 * local development and CI usable without a mail server.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const config = getConfig();

  if (!config.SMTP_URL) {
    if (config.NODE_ENV !== 'test') {
      console.info(`[mail:dev] to=${to} subject="${subject}"\n${text}`);
    }
    return;
  }

  const transport = createTransport(config.SMTP_URL);
  await transport.sendMail({ from: config.MAIL_FROM, to, subject, text });
}
