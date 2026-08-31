import { redis } from '../../redis.js';

export interface CustomOrderMeta {
  durationDays: number;
  trafficGb: number | null;
  deviceLimit: number;
}

export interface CustomFsmState {
  step: 'gb' | 'days' | 'devices';
  trafficGb?: number | null;
  durationDays?: number;
}

const FSM_PREFIX = 'vpn:custom:fsm:';
const META_PREFIX = 'vpn:order:meta:';
const TTL_SECONDS = 86_400 * 7;

/** 2 ₽/GB + 1 ₽/day + 25 ₽/device — same as Enigma Telegram bot. */
export function calculateCustomPrice(gb: number | null, days: number, devices: number): number {
  const trafficPart = gb != null ? gb * 2 : 0;
  return trafficPart + days * 1 + devices * 25;
}

export async function getCustomFsm(userId: string): Promise<CustomFsmState | null> {
  const raw = await redis().get(`${FSM_PREFIX}${userId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomFsmState;
  } catch {
    return null;
  }
}

export async function setCustomFsm(userId: string, state: CustomFsmState | null): Promise<void> {
  const key = `${FSM_PREFIX}${userId}`;
  if (!state) {
    await redis().del(key);
    return;
  }
  await redis().set(key, JSON.stringify(state), 'EX', TTL_SECONDS);
}

export async function setOrderMeta(paymentLabel: string, meta: CustomOrderMeta): Promise<void> {
  await redis().set(`${META_PREFIX}${paymentLabel}`, JSON.stringify(meta), 'EX', TTL_SECONDS);
}

export async function getOrderMeta(paymentLabel: string): Promise<CustomOrderMeta | null> {
  const raw = await redis().get(`${META_PREFIX}${paymentLabel}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomOrderMeta;
  } catch {
    return null;
  }
}

export async function clearOrderMeta(paymentLabel: string): Promise<void> {
  await redis().del(`${META_PREFIX}${paymentLabel}`);
}
