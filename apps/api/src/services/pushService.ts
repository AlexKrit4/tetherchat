import webpush from 'web-push';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { getConfig } from '../config.js';
import { prisma } from '../db.js';
import { shouldDeliverPush } from './pushPolicy.js';

let vapidReady = false;
let fcmReady = false;

function ensureVapid(): boolean {
  const config = getConfig();
  if (!config.VAPID_PUBLIC_KEY || !config.VAPID_PRIVATE_KEY) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(
      config.VAPID_SUBJECT,
      config.VAPID_PUBLIC_KEY,
      config.VAPID_PRIVATE_KEY,
    );
    vapidReady = true;
  }
  return true;
}

function parseServiceAccount(raw: string): Parameters<typeof cert>[0] {
  const trimmed = raw.trim();
  const json = trimmed.startsWith('{')
    ? trimmed
    : Buffer.from(trimmed, 'base64').toString('utf8');
  return JSON.parse(json) as Parameters<typeof cert>[0];
}

function ensureFcm(): boolean {
  const raw = getConfig().FCM_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return false;
  if (!fcmReady) {
    if (getApps().length === 0) {
      initializeApp({ credential: cert(parseServiceAccount(raw)) });
    }
    fcmReady = true;
  }
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url: string;
  tag: string;
  channelId: string;
  serverId?: string;
  messageId?: string;
}

function isFcm(platform: string, endpoint: string): boolean {
  return platform === 'fcm' || !endpoint.startsWith('http');
}

async function sendWebPush(
  subscription: { id: string; endpoint: string; p256dh: string; auth: string },
  body: string,
): Promise<void> {
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
}

async function sendFcm(
  subscriptions: Array<{ id: string; endpoint: string }>,
  payload: PushPayload,
): Promise<void> {
  if (subscriptions.length === 0 || !ensureFcm()) return;

  const data: Record<string, string> = {
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    channelId: payload.channelId,
    serverId: payload.serverId ?? '',
    messageId: payload.messageId ?? '',
  };

  const messaging = getMessaging();
  const BATCH = 500;
  for (let offset = 0; offset < subscriptions.length; offset += BATCH) {
    const chunk = subscriptions.slice(offset, offset + BATCH);
    let result;
    try {
      result = await messaging.sendEachForMulticast({
        tokens: chunk.map((row) => row.endpoint),
        data,
        android: { priority: 'high', collapseKey: payload.tag.slice(0, 64) },
      });
    } catch (error) {
      console.error('[push] FCM send failed:', error);
      return;
    }

    await Promise.all(
      result.responses.map(async (response, index) => {
        if (response.success) return;
        const code = response.error?.code ?? '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token') ||
          code.includes('invalid-argument')
        ) {
          const id = chunk[index]?.id;
          if (id) await prisma.pushSubscription.delete({ where: { id } }).catch(() => undefined);
        }
      }),
    );
  }
}

/** Best-effort delivery: expired endpoints (404/410) are pruned automatically. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });
  if (subscriptions.length === 0) return;

  const web = subscriptions.filter((row) => !isFcm(row.platform, row.endpoint));
  const fcm = subscriptions.filter((row) => isFcm(row.platform, row.endpoint));

  const body = JSON.stringify(payload);
  if (ensureVapid() && web.length > 0) {
    await Promise.all(web.map((subscription) => sendWebPush(subscription, body)));
  }
  await sendFcm(fcm, payload);
}

/** Recipients that asked not to be notified for this channel are filtered out. */
export { shouldDeliverPush } from './pushPolicy.js';

export async function filterNotifiableUsers(
  channelId: string,
  userIds: string[],
  options: { mentionedUserIds: string[]; mentionsEveryone: boolean },
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const settings = await prisma.channelNotificationSetting.findMany({
    where: { channelId, userId: { in: userIds } },
  });
  const byUser = new Map(settings.map((setting) => [setting.userId, setting]));
  const mentioned = new Set(options.mentionedUserIds);

  return userIds.filter((userId) => {
    const isMention = options.mentionsEveryone || mentioned.has(userId);
    return shouldDeliverPush(byUser.get(userId), isMention);
  });
}
