/**
 * Member lists and avatars treat invisible the same as offline: the person
 * asked not to appear in the session, so they must not sit in the Online group.
 */
export function isPresentOnline(status: string | undefined | null): boolean {
  return status === 'online' || status === 'idle' || status === 'dnd';
}
