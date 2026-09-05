import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_PERMISSIONS, Permission } from '@tetherchat/shared';
import type { Channel, Invite, Role, ServerDetail, ServerMember, ServerSummary } from '@tetherchat/shared';
import { prisma } from '../db.js';
import { closeTestApp, createServer, createUser, firstChannel, testApp } from './harness.js';
import type { TestUser } from './harness.js';

let owner: TestUser;
let guest: TestUser;

beforeAll(async () => {
  owner = await createUser();
  guest = await createUser();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [owner.id, guest.id] } } });
  await closeTestApp();
});

describe('servers', () => {
  it('creates a server with a default role and starter channels', async () => {
    const server = await createServer(owner, 'Friendos Clone');

    expect(server.ownerId).toBe(owner.id);
    expect(server.permissions).toBe(ALL_PERMISSIONS);
    expect(server.roles.some((role) => role.isDefault)).toBe(true);
    expect(server.channels.map((channel) => channel.name)).toContain('general');
    expect(server.categories).toHaveLength(1);
  });

  it('lists only the servers the caller belongs to', async () => {
    const server = await createServer(owner, 'Private Place');
    const app = await testApp();

    const mine = await app.inject({ method: 'GET', url: '/api/servers', headers: owner.auth });
    expect(mine.json<ServerSummary[]>().some((entry) => entry.id === server.id)).toBe(true);

    const theirs = await app.inject({ method: 'GET', url: '/api/servers', headers: guest.auth });
    expect(theirs.json<ServerSummary[]>().some((entry) => entry.id === server.id)).toBe(false);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/servers/${server.id}`,
      headers: guest.auth,
    });
    expect(detail.statusCode).toBe(403);
  });

  it('joins through an invite and rejects an unknown code', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Invite Flow');

    const created = await app.inject({
      method: 'POST',
      url: `/api/servers/${server.id}/invite`,
      headers: owner.auth,
      payload: {},
    });
    const invite = created.json<Invite>();

    const preview = await app.inject({ method: 'GET', url: `/api/invite/${invite.code}` });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().server.name).toBe('Invite Flow');

    const joined = await app.inject({
      method: 'POST',
      url: `/api/invite/${invite.code}/join`,
      headers: guest.auth,
    });
    expect(joined.statusCode).toBe(200);

    const members = await app.inject({
      method: 'GET',
      url: `/api/servers/${server.id}/members`,
      headers: guest.auth,
    });
    expect(members.json<ServerMember[]>().some((entry) => entry.userId === guest.id)).toBe(true);

    const unknown = await app.inject({
      method: 'POST',
      url: '/api/invite/does-not-exist/join',
      headers: guest.auth,
    });
    expect(unknown.statusCode).toBe(404);
  });

  it('stops an exhausted invite from being reused', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'One Shot');

    const invite = (
      await app.inject({
        method: 'POST',
        url: `/api/servers/${server.id}/invite`,
        headers: owner.auth,
        payload: { maxUses: 1 },
      })
    ).json<Invite>();

    const first = await createUser();
    const second = await createUser();

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/invite/${invite.code}/join`,
          headers: first.auth,
        })
      ).statusCode,
    ).toBe(200);

    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/invite/${invite.code}/join`,
          headers: second.auth,
        })
      ).statusCode,
    ).toBe(404);

    await prisma.user.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  });

  it('does not let two callers consume a single-use invite at once', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Race Invite');
    const invite = (
      await app.inject({
        method: 'POST',
        url: `/api/servers/${server.id}/invite`,
        headers: owner.auth,
        payload: { maxUses: 1 },
      })
    ).json<Invite>();

    const first = await createUser();
    const second = await createUser();
    const results = await Promise.all([
      app.inject({ method: 'POST', url: `/api/invite/${invite.code}/join`, headers: first.auth }),
      app.inject({ method: 'POST', url: `/api/invite/${invite.code}/join`, headers: second.auth }),
    ]);

    expect(results.filter((row) => row.statusCode === 200)).toHaveLength(1);
    expect(results.filter((row) => row.statusCode === 404)).toHaveLength(1);

    const members = await prisma.serverMember.count({ where: { serverId: server.id } });
    expect(members).toBe(2);

    const uses = await prisma.invite.findUniqueOrThrow({
      where: { code: invite.code },
      select: { uses: true },
    });
    expect(uses.uses).toBe(1);

    await prisma.user.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  });

  it('hides channels from members who lack VIEW_CHANNEL', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Staff Only');
    const everyone = server.roles.find((role) => role.isDefault);
    expect(everyone).toBeTruthy();

    const invite = (
      await app.inject({
        method: 'POST',
        url: `/api/servers/${server.id}/invite`,
        headers: owner.auth,
        payload: {},
      })
    ).json<Invite>();
    await app.inject({
      method: 'POST',
      url: `/api/invite/${invite.code}/join`,
      headers: guest.auth,
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/servers/${server.id}/roles/${everyone!.id}`,
      headers: owner.auth,
      payload: { permissions: 0 },
    });

    const detail = await app.inject({
      method: 'GET',
      url: `/api/servers/${server.id}`,
      headers: guest.auth,
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json<ServerDetail>().channels).toHaveLength(0);

    const listed = await app.inject({
      method: 'GET',
      url: `/api/servers/${server.id}/channels`,
      headers: guest.auth,
    });
    expect(listed.json<Channel[]>()).toHaveLength(0);

    const channelId = firstChannel(server).id;
    const history = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelId}/messages`,
      headers: guest.auth,
    });
    expect(history.statusCode).toBe(403);

    await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/messages`,
      headers: owner.auth,
      payload: { content: '@everyone secret staff note' },
    });

    const states = await app.inject({
      method: 'GET',
      url: '/api/users/@me/read-states',
      headers: guest.auth,
    });
    const leaked = states.json<{ channelId: string; mentionCount: number }[]>().find(
      (row) => row.channelId === channelId,
    );
    expect(leaked).toBeUndefined();

    const mentionRow = await prisma.readState.findUnique({
      where: { userId_channelId: { userId: guest.id, channelId } },
    });
    expect(mentionRow?.mentionCount ?? 0).toBe(0);
  });

  it('requires MANAGE_CHANNELS to create or delete a channel', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Channel Perms');

    const invite = (
      await app.inject({
        method: 'POST',
        url: `/api/servers/${server.id}/invite`,
        headers: owner.auth,
        payload: {},
      })
    ).json<Invite>();
    await app.inject({
      method: 'POST',
      url: `/api/invite/${invite.code}/join`,
      headers: guest.auth,
    });

    const denied = await app.inject({
      method: 'POST',
      url: `/api/servers/${server.id}/channels`,
      headers: guest.auth,
      payload: { name: 'sneaky' },
    });
    expect(denied.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'POST',
      url: `/api/servers/${server.id}/channels`,
      headers: owner.auth,
      payload: { name: 'Team Updates', topic: 'weekly' },
    });
    expect(allowed.statusCode).toBe(201);
    // Names are normalised the way Discord does it.
    expect(allowed.json<Channel>().name).toBe('team-updates');
  });

  it('keeps the last channel from being deleted', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Last Channel');

    for (const channel of server.channels.slice(1)) {
      await app.inject({
        method: 'DELETE',
        url: `/api/channels/${channel.id}`,
        headers: owner.auth,
      });
    }

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/channels/${firstChannel(server).id}`,
      headers: owner.auth,
    });
    expect(response.statusCode).toBe(400);
  });

  it('refuses to grant permissions the actor does not hold', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Escalation');

    const invite = (
      await app.inject({
        method: 'POST',
        url: `/api/servers/${server.id}/invite`,
        headers: owner.auth,
        payload: {},
      })
    ).json<Invite>();
    await app.inject({
      method: 'POST',
      url: `/api/invite/${invite.code}/join`,
      headers: guest.auth,
    });

    // Give the guest MANAGE_ROLES but nothing else dangerous.
    await prisma.role.updateMany({
      where: { serverId: server.id, isDefault: true },
      data: { permissions: Permission.VIEW_CHANNEL | Permission.MANAGE_ROLES },
    });

    const escalate = await app.inject({
      method: 'POST',
      url: `/api/servers/${server.id}/roles`,
      headers: guest.auth,
      payload: { name: 'Sneaky Admin', permissions: Permission.ADMINISTRATOR },
    });
    expect(escalate.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'POST',
      url: `/api/servers/${server.id}/roles`,
      headers: guest.auth,
      payload: { name: 'Viewer', permissions: Permission.VIEW_CHANNEL },
    });
    expect(allowed.statusCode).toBe(201);
    expect(allowed.json<Role>().name).toBe('Viewer');
  });

  it('never lets the default role be deleted or renamed', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Everyone Role');
    const everyone = server.roles.find((role) => role.isDefault)!;

    const renamed = await app.inject({
      method: 'PATCH',
      url: `/api/servers/${server.id}/roles/${everyone.id}`,
      headers: owner.auth,
      payload: { name: 'peasants' },
    });
    expect(renamed.statusCode).toBe(400);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/servers/${server.id}/roles/${everyone.id}`,
      headers: owner.auth,
    });
    expect(deleted.statusCode).toBe(400);
  });

  it('bans a member, blocks the invite and lifts the ban again', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Ban Hammer');
    const target = await createUser();

    const invite = (
      await app.inject({
        method: 'POST',
        url: `/api/servers/${server.id}/invite`,
        headers: owner.auth,
        payload: {},
      })
    ).json<Invite>();
    await app.inject({
      method: 'POST',
      url: `/api/invite/${invite.code}/join`,
      headers: target.auth,
    });

    const banned = await app.inject({
      method: 'PUT',
      url: `/api/servers/${server.id}/bans/${target.id}`,
      headers: owner.auth,
      payload: { reason: 'spam' },
    });
    expect(banned.statusCode).toBe(204);

    const rejoin = await app.inject({
      method: 'POST',
      url: `/api/invite/${invite.code}/join`,
      headers: target.auth,
    });
    expect(rejoin.statusCode).toBe(403);

    const lifted = await app.inject({
      method: 'DELETE',
      url: `/api/servers/${server.id}/bans/${target.id}`,
      headers: owner.auth,
    });
    expect(lifted.statusCode).toBe(204);

    const afterLift = await app.inject({
      method: 'POST',
      url: `/api/invite/${invite.code}/join`,
      headers: target.auth,
    });
    expect(afterLift.statusCode).toBe(200);

    await prisma.user.delete({ where: { id: target.id } });
  });

  it('stops the owner from leaving and lets others leave', async () => {
    const app = await testApp();
    const server = await createServer(owner, 'Exit Door');

    const invite = (
      await app.inject({
        method: 'POST',
        url: `/api/servers/${server.id}/invite`,
        headers: owner.auth,
        payload: {},
      })
    ).json<Invite>();
    await app.inject({
      method: 'POST',
      url: `/api/invite/${invite.code}/join`,
      headers: guest.auth,
    });

    const ownerLeaves = await app.inject({
      method: 'POST',
      url: `/api/servers/${server.id}/leave`,
      headers: owner.auth,
    });
    expect(ownerLeaves.statusCode).toBe(400);

    const guestLeaves = await app.inject({
      method: 'POST',
      url: `/api/servers/${server.id}/leave`,
      headers: guest.auth,
    });
    expect(guestLeaves.statusCode).toBe(204);
  });

  it('deletes a server and cascades its channels and messages', async () => {
    const app = await testApp();
    const server: ServerDetail = await createServer(owner, 'Doomed');
    const channelId = firstChannel(server).id;

    await app.inject({
      method: 'POST',
      url: `/api/channels/${channelId}/messages`,
      headers: owner.auth,
      payload: { content: 'about to disappear' },
    });

    const notOwner = await app.inject({
      method: 'DELETE',
      url: `/api/servers/${server.id}`,
      headers: guest.auth,
    });
    expect(notOwner.statusCode).toBe(403);

    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/servers/${server.id}`,
      headers: owner.auth,
    });
    expect(deleted.statusCode).toBe(204);

    expect(await prisma.channel.count({ where: { serverId: server.id } })).toBe(0);
    expect(await prisma.message.count({ where: { channelId } })).toBe(0);
  });
});
