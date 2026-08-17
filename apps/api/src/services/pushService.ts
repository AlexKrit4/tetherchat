import webpush from 'web-push';
import { getConfig } from '../config.js';
import { prisma } from '../db.js';

let configured = false;

function ensureConfigured(): boolean {
  const config = getConfig();
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  if (!configured) {
    webpush.setVapidDetails(
      config.VAPID_SUBJECT,
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY,
    );
    configured = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url: string;
  tag: string;
}

/** Best-effort delivery: expired endpoints (404/410) are pruned automatically. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0 || !ensureConfigured()) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        }
      }
    }),
  );
}

/** Recipients that asked not to be notified for this channel are filtered out. */
export async function filterNotifiableUsers(
  channelId: string,
  userIds: string[],
  options: { isMention: boolean },
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const settings = await prisma.channelNotificationSetting.findMany({
    where: { channelId, userId: { in: userIds } },
  });
  const byUser = new Map(settings.map((setting) => [setting.userId, setting]));

  return userIds.filter((userId) => {
    const setting = byUser.get(userId);
    if (!setting) return true;
    if (setting.muted) return false;
    if (setting.level === 'nothing') return false;
    if (setting.level === 'mentions') return options.isMention;
    return true;
  });
}
