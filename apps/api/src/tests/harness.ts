import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { DEFAULT_PERMISSIONS, DEFAULT_ROLE_NAME } from '@tetherchat/shared';
import type { AuthResponse, Channel, ServerDetail } from '@tetherchat/shared';
import { buildApp } from '../app.js';
import { prisma } from '../db.js';

let app: FastifyInstance | null = null;

export async function testApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function closeTestApp(): Promise<void> {
  await app?.close();
  app = null;
  await prisma.$disconnect();
}

export interface TestUser {
  id: string;
  email: string;
  username: string;
  password: string;
  accessToken: string;
  refreshToken?: string;
  auth: { authorization: string };
}

/** Registers a fresh account through the public API, exactly like a real client. */
export async function createUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const instance = await testApp();
  const suffix = randomUUID().slice(0, 8);
  const username = overrides.username ?? `user${suffix}`;
  const email = overrides.email ?? `${username}@example.test`;
  const password = overrides.password ?? 'sup3r-secret-pass';

  const response = await instance.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: { email, username, password },
  });

  if (response.statusCode !== 201) {
    throw new Error(`register failed: ${response.statusCode} ${response.body}`);
  }

  const body = response.json<AuthResponse>();
  return {
    id: body.user.id,
    email,
    username,
    password,
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    auth: { authorization: `Bearer ${body.accessToken}` },
  };
}

export async function createServer(owner: TestUser, name = 'Test Server'): Promise<ServerDetail> {
  const instance = await testApp();
  const response = await instance.inject({
    method: 'POST',
    url: '/api/servers',
    headers: owner.auth,
    payload: { name },
  });
  if (response.statusCode !== 201) {
    throw new Error(`create server failed: ${response.statusCode} ${response.body}`);
  }
  return response.json<ServerDetail>();
}

export function firstChannel(server: ServerDetail): Channel {
  const channel = server.channels[0];
  if (!channel) throw new Error('server has no channels');
  return channel;
}

/** Makes two users friends without going through the request UI. */
export async function linkFriends(a: TestUser, b: TestUser): Promise<void> {
  await prisma.friendship.createMany({
    data: [
      { userId: a.id, friendId: b.id },
      { userId: b.id, friendId: a.id },
    ],
    skipDuplicates: true,
  });
}

/** Adds a member directly, skipping the invite dance when it is not the subject. */
export async function joinServer(serverId: string, user: TestUser): Promise<void> {
  const everyone = await prisma.role.findFirst({
    where: { serverId, isDefault: true },
    select: { id: true },
  });
  const member = await prisma.serverMember.create({
    data: { serverId, userId: user.id },
  });
  if (everyone) {
    await prisma.serverMemberRole.create({ data: { memberId: member.id, roleId: everyone.id } });
  }
}

export async function grantPermissions(serverId: string, mask: number): Promise<void> {
  await prisma.role.updateMany({
    where: { serverId, isDefault: true },
    data: { permissions: mask },
  });
}

export async function resetDefaultRole(serverId: string): Promise<void> {
  await prisma.role.updateMany({
    where: { serverId, name: DEFAULT_ROLE_NAME },
    data: { permissions: DEFAULT_PERMISSIONS },
  });
}

/** Removes only the rows a test created, keeping any demo data intact. */
export async function cleanupUsers(users: TestUser[]): Promise<void> {
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
}
