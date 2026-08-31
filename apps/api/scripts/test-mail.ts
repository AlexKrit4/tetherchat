/**
 * Quick SMTP check. Loads .env, sends one message, exits.
 *
 *   npm run mail:test -- you@example.com
 *
 * Gmail example in .env:
 *   SMTP_URL=smtps://tetherchat@gmail.com:APP_PASSWORD@smtp.gmail.com:465
 *   MAIL_FROM=TetherChat <tetherchat@gmail.com>
 */
import { getConfig } from '../src/config.js';
import { sendMail } from '../src/services/mailService.js';

const to = process.argv[2]?.trim();
if (!to) {
  console.error('Usage: npm run mail:test -- recipient@example.com');
  process.exit(1);
}

const config = getConfig();
if (!config.SMTP_URL && !config.RESEND_API_KEY) {
  console.error('Set SMTP_URL (or RESEND_API_KEY) in .env first. See .env.example.');
  process.exit(1);
}

await sendMail(
  to,
  'TetherChat — тест почты',
  'Если вы видите это письмо, SMTP настроен правильно.',
  '<p>Если вы видите это письмо, <strong>SMTP настроен правильно</strong>.</p>',
);

console.log(`Test email sent to ${to} via ${config.SMTP_URL ? 'SMTP' : 'Resend'}. From: ${config.MAIL_FROM}`);
