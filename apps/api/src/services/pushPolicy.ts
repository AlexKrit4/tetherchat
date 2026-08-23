/** Pure notification policy so channel mute/level can be unit-tested without Prisma. */
export function shouldDeliverPush(
  setting: { muted: boolean; level: string } | undefined,
  isMention: boolean,
): boolean {
  if (!setting) return true;
  if (setting.muted) return false;
  if (setting.level === 'nothing') return false;
  if (setting.level === 'mentions') return isMention;
  return true;
}
