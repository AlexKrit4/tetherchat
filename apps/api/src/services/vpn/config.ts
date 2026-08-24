import { createHash, createHmac, randomBytes } from 'node:crypto';
import { getConfig } from '../../config.js';

export interface VpnRuntimeConfig {
  brandName: string;
  subscriptionPrefix: string;
  marzbanUrl: string;
  marzbanUsername: string;
  marzbanPassword: string;
  marzbanMock: boolean;
  yoomoneyWallet: string;
  yoomoneyNotificationSecret: string;
  trialEnabled: boolean;
  trialDurationDays: number;
  trialTrafficGb: number;
  trialDeviceLimit: number;
  vpnNodeId: string;
}

export function getVpnConfig(): VpnRuntimeConfig {
  const config = getConfig();
  return {
    brandName: config.VPN_BRAND_NAME,
    subscriptionPrefix: config.VPN_SUBSCRIPTION_PREFIX,
    marzbanUrl: config.MARZBAN_URL,
    marzbanUsername: config.MARZBAN_USERNAME,
    marzbanPassword: config.MARZBAN_PASSWORD,
    marzbanMock: config.MARZBAN_MOCK,
    yoomoneyWallet: config.YOOMONEY_WALLET,
    yoomoneyNotificationSecret: config.YOOMONEY_NOTIFICATION_SECRET,
    trialEnabled: config.VPN_TRIAL_ENABLED,
    trialDurationDays: config.VPN_TRIAL_DURATION_DAYS,
    trialTrafficGb: config.VPN_TRIAL_TRAFFIC_GB,
    trialDeviceLimit: config.VPN_TRIAL_DEVICE_LIMIT,
    vpnNodeId: config.VPN_NODE_ID,
  };
}

export function buildSubUrl(subToken: string): string {
  const prefix = getVpnConfig().subscriptionPrefix.replace(/\/$/, '');
  return `${prefix}/${subToken}`;
}

export function buildPaymentLabel(): string {
  return randomBytes(9).toString('base64url');
}

export function createYooMoneyPaymentUrl(input: {
  amount: string;
  label: string;
  description: string;
}): string {
  const { yoomoneyWallet } = getVpnConfig();
  const config = getConfig();
  if (!yoomoneyWallet) {
    return `${config.PUBLIC_WEB_ORIGIN}/api/vpn/pay/mock?label=${encodeURIComponent(input.label)}`;
  }
  const params = new URLSearchParams({
    receiver: yoomoneyWallet,
    'quickpay-form': 'shop',
    targets: input.description,
    paymentType: 'SB',
    sum: input.amount,
    label: input.label,
    successURL: `${config.PUBLIC_WEB_ORIGIN}/channels/@me`,
  });
  return `https://yoomoney.ru/quickpay/confirm.xml?${params.toString()}`;
}

function verifySha1(form: Record<string, string>, secret: string): boolean {
  const checkString = [
    form.notification_type ?? '',
    form.operation_id ?? '',
    form.amount ?? '',
    form.currency ?? '',
    form.datetime ?? '',
    form.sender ?? '',
    form.codepro ?? '',
    secret,
    form.label ?? '',
  ].join('&');
  const expected = createHash('sha1').update(checkString).digest('hex');
  return Boolean(form.sha1_hash) && expected.toLowerCase() === form.sha1_hash.toLowerCase();
}

function verifySign(form: Record<string, string>, secret: string): boolean {
  const got = form.sign;
  if (!got) return false;
  const parts = Object.keys(form)
    .filter((key) => key !== 'sign')
    .sort()
    .map((key) => `${key}=${encodeURIComponent(form[key] ?? '')}`);
  const payload = parts.join('&');
  const expected = createHmac('sha256', secret).update(payload).digest('hex');
  return expected.toLowerCase() === got.toLowerCase();
}

export function verifyYooMoneyNotification(form: Record<string, string>): {
  ok: boolean;
  label: string;
  externalId: string;
  amount: string;
  error?: string;
} {
  const secret = getVpnConfig().yoomoneyNotificationSecret;
  const label = form.label ?? '';
  const externalId = form.operation_id ?? '';
  const amount = form.amount ?? '0';

  if (!secret) {
    return { ok: false, label, externalId, amount, error: 'YOOMONEY_NOTIFICATION_SECRET not configured' };
  }
  if (!externalId || !('amount' in form)) {
    return { ok: false, label, externalId, amount, error: 'missing operation_id or amount' };
  }
  if (!verifySign(form, secret) && !verifySha1(form, secret)) {
    return { ok: false, label, externalId, amount, error: 'invalid signature' };
  }
  if ((form.codepro ?? 'false').toLowerCase() === 'true') {
    return { ok: false, label, externalId, amount, error: 'code-protected transfer ignored' };
  }
  return { ok: true, label, externalId, amount };
}
