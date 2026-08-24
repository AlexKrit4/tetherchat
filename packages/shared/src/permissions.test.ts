import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  Permission,
  can,
  combinePermissions,
  listPermissions,
  resolvePermissions,
  togglePermission,
} from './permissions.js';

describe('permissions', () => {
  it('combines role masks', () => {
    const mask = combinePermissions([Permission.VIEW_CHANNEL, Permission.SEND_MESSAGES]);
    expect(can(mask, Permission.VIEW_CHANNEL)).toBe(true);
    expect(can(mask, Permission.SEND_MESSAGES)).toBe(true);
    expect(can(mask, Permission.BAN_MEMBERS)).toBe(false);
  });

  it('treats ADMINISTRATOR as every permission', () => {
    const mask = combinePermissions([Permission.ADMINISTRATOR]);
    expect(mask).toBe(ALL_PERMISSIONS);
    expect(can(mask, Permission.BAN_MEMBERS)).toBe(true);
  });

  it('grants owners everything without roles', () => {
    expect(resolvePermissions({ isOwner: true, roleMasks: [] })).toBe(ALL_PERMISSIONS);
  });

  it('applies channel allow and deny overwrites', () => {
    const mask = resolvePermissions({
      isOwner: false,
      roleMasks: [DEFAULT_PERMISSIONS],
      channelDeny: Permission.SEND_MESSAGES,
    });
    expect(can(mask, Permission.VIEW_CHANNEL)).toBe(true);
    expect(can(mask, Permission.SEND_MESSAGES)).toBe(false);

    const elevated = resolvePermissions({
      isOwner: false,
      roleMasks: [Permission.VIEW_CHANNEL],
      channelAllow: Permission.MANAGE_MESSAGES,
    });
    expect(can(elevated, Permission.MANAGE_MESSAGES)).toBe(true);
  });

  it('lets deny win over allow for the same flag', () => {
    const mask = resolvePermissions({
      isOwner: false,
      roleMasks: [DEFAULT_PERMISSIONS],
      channelAllow: Permission.SEND_MESSAGES,
      channelDeny: Permission.SEND_MESSAGES,
    });
    expect(can(mask, Permission.SEND_MESSAGES)).toBe(false);
  });

  it('ignores channel overwrites for administrators', () => {
    const mask = resolvePermissions({
      isOwner: false,
      roleMasks: [Permission.ADMINISTRATOR],
      channelDeny: Permission.VIEW_CHANNEL,
    });
    expect(can(mask, Permission.VIEW_CHANNEL)).toBe(true);
  });

  it('toggles a single flag', () => {
    const on = togglePermission(0, Permission.KICK_MEMBERS);
    expect(listPermissions(on)).toEqual(['KICK_MEMBERS']);
    expect(togglePermission(on, Permission.KICK_MEMBERS)).toBe(0);
  });
});
