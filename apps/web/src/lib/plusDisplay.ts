import { LIMITS } from '@tetherchat/shared';
import type { PublicUser, SelfUser } from '@tetherchat/shared';
import { t } from '@/i18n';
import { relativeFromNow } from '@/lib/time';

const URL_RE = /(https?:\/\/[^\s<]+)/gi;

export function isPlusUser(user: Pick<PublicUser, 'isPlus'> | null | undefined): boolean {
  return Boolean(user?.isPlus);
}

export function nameAccent(
  user: Pick<PublicUser, 'isPlus' | 'accentColor'> | null | undefined,
): string | undefined {
  if (!user?.isPlus || !user.accentColor) return undefined;
  return user.accentColor;
}

export function bioMax(user: Pick<SelfUser, 'isPlus'> | null | undefined): number {
  return user?.isPlus ? LIMITS.bio.plus : LIMITS.bio.max;
}

export function attachmentMax(user: Pick<SelfUser, 'isPlus'> | null | undefined): number {
  return user?.isPlus ? LIMITS.attachmentBytesPlus : LIMITS.attachmentBytes;
}

export function pinnedMax(user: Pick<SelfUser, 'isPlus'> | null | undefined): number {
  return user?.isPlus ? LIMITS.pinnedDmsPlus : LIMITS.pinnedDms;
}

export function lastSeenLabel(
  user: Pick<PublicUser, 'status' | 'lastSeenAt' | 'isPlus'>,
  liveStatus?: string,
): string {
  const status = liveStatus ?? user.status;
  if (status === 'online') return t('common.online');
  if (status === 'idle') return t('common.idle');
  if (status === 'dnd') return t('common.dnd');
  if (user.lastSeenAt) return t('plus.lastSeen', { time: relativeFromNow(user.lastSeenAt) });
  return t('common.offline');
}

export function splitBioLinks(text: string): { type: 'text' | 'link'; value: string }[] {
  const parts = text.split(URL_RE);
  return parts.filter(Boolean).map((part) =>
    /^https?:\/\//i.test(part) ? { type: 'link' as const, value: part } : { type: 'text' as const, value: part },
  );
}
