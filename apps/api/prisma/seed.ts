/**
 * Demo data: the "Friendos" server from the design reference, so a fresh
 * `docker compose up` lands on a populated UI instead of an empty state.
 *
 * Every demo account uses the password `tetherchat`.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  ALL_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_NAME,
  MODERATOR_PERMISSIONS,
  encodeUserMention,
} from '@tetherchat/shared';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'tetherchat';

interface DemoUser {
  username: string;
  displayName: string;
  email: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  customStatus?: string;
  bannerColor: string;
}

const users: DemoUser[] = [
  {
    username: 'hoods',
    displayName: 'Hoods',
    email: 'hoods@tetherchat.ru',
    status: 'online',
    bannerColor: '#ed4245',
  },
  {
    username: 'wumpus',
    displayName: 'Wumpus',
    email: 'wumpus@tetherchat.ru',
    status: 'online',
    bannerColor: '#5865f2',
  },
  {
    username: 'phibi',
    displayName: 'Phibi',
    email: 'phibi@tetherchat.ru',
    status: 'online',
    customStatus: 'Listening to Spotify',
    bannerColor: '#3ba55d',
  },
  {
    username: 'chad',
    displayName: 'Chad',
    email: 'chad@tetherchat.ru',
    status: 'idle',
    bannerColor: '#faa81a',
  },
  {
    username: 'mallow',
    displayName: 'Mallow',
    email: 'mallow@tetherchat.ru',
    status: 'online',
    customStatus: 'Playing Journey',
    bannerColor: '#eb459e',
  },
  {
    username: 'face',
    displayName: 'Face',
    email: 'face@tetherchat.ru',
    status: 'offline',
    bannerColor: '#9b59b6',
  },
];

async function main() {
  console.info('Seeding TetherChat demo data...');

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const created = new Map<string, string>();
  for (const user of users) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: { status: user.status, customStatus: user.customStatus ?? null },
      create: {
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        passwordHash,
        emailVerified: true,
        status: user.status,
        customStatus: user.customStatus ?? null,
        bannerColor: user.bannerColor,
        bio:
          user.username === 'hoods'
            ? 'Runs the server, forgets to water the plants.'
            : null,
      },
    });
    created.set(user.username, row.id);
  }

  const ownerId = created.get('hoods')!;

  // A rerun should not stack duplicate servers.
  await prisma.server.deleteMany({ where: { name: 'Friendos', ownerId } });

  const server = await prisma.server.create({
    data: {
      name: 'Friendos',
      ownerId,
      description: 'a place for friends to talk',
    },
  });

  const everyone = await prisma.role.create({
    data: {
      serverId: server.id,
      name: DEFAULT_ROLE_NAME,
      permissions: DEFAULT_PERMISSIONS,
      position: 0,
      isDefault: true,
    },
  });

  const members = await prisma.role.create({
    data: {
      serverId: server.id,
      name: 'Members',
      color: '#3ba55d',
      permissions: DEFAULT_PERMISSIONS,
      position: 1,
      hoist: true,
    },
  });

  const moderator = await prisma.role.create({
    data: {
      serverId: server.id,
      name: 'Moderator',
      color: '#3498db',
      permissions: MODERATOR_PERMISSIONS,
      position: 2,
      hoist: true,
    },
  });

  const leader = await prisma.role.create({
    data: {
      serverId: server.id,
      name: 'Fearless Leader',
      color: '#faa81a',
      permissions: ALL_PERMISSIONS,
      position: 3,
      hoist: true,
    },
  });

  for (const user of users) {
    const userId = created.get(user.username)!;
    const member = await prisma.serverMember.create({
      data: { serverId: server.id, userId },
    });

    const roleIds = [everyone.id, members.id];
    if (user.username === 'hoods') roleIds.push(leader.id, moderator.id);
    if (user.username === 'wumpus') roleIds.push(moderator.id);

    await prisma.serverMemberRole.createMany({
      data: roleIds.map((roleId) => ({ memberId: member.id, roleId })),
    });
  }

  const mainHall = await prisma.category.create({
    data: { serverId: server.id, name: 'Main Hall', position: 0 },
  });
  const hangingOut = await prisma.category.create({
    data: { serverId: server.id, name: 'Hanging Out', position: 1 },
  });

  const announcements = await prisma.channel.create({
    data: {
      serverId: server.id,
      categoryId: mainHall.id,
      name: 'announcements',
      topic: 'Server news, read-only-ish',
      position: 0,
    },
  });
  const chat = await prisma.channel.create({
    data: {
      serverId: server.id,
      categoryId: mainHall.id,
      name: 'chat',
      topic: 'a place for friends to talk',
      position: 1,
    },
  });
  const offTopic = await prisma.channel.create({
    data: { serverId: server.id, categoryId: mainHall.id, name: 'off-topic', position: 2 },
  });
  const memes = await prisma.channel.create({
    data: {
      serverId: server.id,
      categoryId: mainHall.id,
      name: 'memes',
      topic: 'post the good ones',
      position: 3,
    },
  });
  await prisma.channel.createMany({
    data: [
      { serverId: server.id, categoryId: hangingOut.id, name: 'music', position: 0 },
      { serverId: server.id, categoryId: hangingOut.id, name: 'shows', position: 1 },
      { serverId: server.id, categoryId: hangingOut.id, name: 'photos', position: 2 },
    ],
  });

  const base = new Date(Date.now() - 60 * 60 * 1000);
  let offset = 0;
  const at = (minutes: number) => new Date(base.getTime() + minutes * 60_000);

  const script: {
    channelId: string;
    author: string;
    content: string;
    minutes: number;
    mentions?: string[];
    everyone?: boolean;
  }[] = [
    {
      channelId: announcements.id,
      author: 'hoods',
      content: '**Welcome to Friendos.** Keep it kind, keep it weird. Show schedule lives in #shows.',
      minutes: (offset += 0),
    },
    {
      channelId: chat.id,
      author: 'mallow',
      content: "it's been a while since we all got together :(",
      minutes: (offset += 3),
    },
    {
      channelId: chat.id,
      author: 'wumpus',
      content: 'Wanna watch the next episode?',
      minutes: (offset += 1),
    },
    {
      channelId: chat.id,
      author: 'mallow',
      content: '@everyone when are y-all free to watch?!',
      minutes: (offset += 1),
      everyone: true,
    },
    { channelId: chat.id, author: 'hoods', content: 'maybe 8pm?', minutes: (offset += 1) },
    {
      channelId: chat.id,
      author: 'wumpus',
      content: 'Works for me! I should be done with practice by 5 at the latest.',
      minutes: (offset += 1),
    },
    {
      channelId: chat.id,
      author: 'hoods',
      content: "yay! here's to hoping the next episode doesn't end with a cliffhanger 🤞",
      minutes: (offset += 1),
    },
    {
      channelId: chat.id,
      author: 'phibi',
      content: "Let's do this. Can't wait. Also I think I have a couple of new people to invite if that's cool?",
      minutes: (offset += 2),
    },
    {
      channelId: chat.id,
      author: 'hoods',
      content: "i'm around all evening, meet me here?",
      minutes: (offset += 1),
    },
    {
      channelId: chat.id,
      author: 'phibi',
      content: 'sounds good, give me one sec!',
      minutes: (offset += 1),
    },
    {
      channelId: chat.id,
      author: 'chad',
      content: `${encodeUserMention(created.get('phibi')!)} bring snacks or don't come at all`,
      minutes: (offset += 1),
      mentions: [created.get('phibi')!],
    },
    {
      channelId: memes.id,
      author: 'wumpus',
      content: 'penguin slide, still undefeated',
      minutes: (offset += 1),
    },
    {
      channelId: offTopic.id,
      author: 'chad',
      content: 'anyone else stress-baking or is it just me',
      minutes: (offset += 2),
    },
  ];

  const messageIds: Record<string, string> = {};

  for (const entry of script) {
    const message = await prisma.message.create({
      data: {
        channelId: entry.channelId,
        authorId: created.get(entry.author)!,
        content: entry.content,
        createdAt: at(entry.minutes),
        mentionedUserIds: entry.mentions ?? [],
        mentionsEveryone: entry.everyone ?? false,
      },
    });
    messageIds[`${entry.author}:${entry.minutes}`] = message.id;
  }

  // One reply thread and a few reactions so those UI states are visible.
  const cliffhanger = await prisma.message.findFirst({
    where: { channelId: chat.id, content: { contains: 'cliffhanger' } },
    select: { id: true },
  });

  if (cliffhanger) {
    await prisma.message.create({
      data: {
        channelId: chat.id,
        authorId: created.get('wumpus')!,
        content: 'it always ends with a cliffhanger, brace yourself',
        replyToId: cliffhanger.id,
        createdAt: at(offset + 1),
      },
    });

    await prisma.messageReaction.createMany({
      data: [
        { messageId: cliffhanger.id, userId: created.get('wumpus')!, emoji: '🤞' },
        { messageId: cliffhanger.id, userId: created.get('mallow')!, emoji: '🤞' },
        { messageId: cliffhanger.id, userId: created.get('phibi')!, emoji: '❤️' },
      ],
      skipDuplicates: true,
    });
  }

  const welcome = await prisma.message.findFirst({
    where: { channelId: announcements.id },
    select: { id: true },
  });
  if (welcome) {
    await prisma.message.update({ where: { id: welcome.id }, data: { pinned: true } });
    await prisma.pin.upsert({
      where: { messageId: welcome.id },
      create: { messageId: welcome.id, channelId: announcements.id, pinnedById: ownerId },
      update: {},
    });
  }

  await prisma.invite.upsert({
    where: { code: 'friendos' },
    create: { code: 'friendos', serverId: server.id, inviterId: ownerId },
    update: {},
  });

  // A one-on-one conversation so the DM view is not empty either.
  const dmPeers = [created.get('hoods')!, created.get('phibi')!];
  const existingDm = await prisma.directConversation.findFirst({
    where: {
      isGroup: false,
      AND: dmPeers.map((userId) => ({ members: { some: { userId } } })),
    },
    select: { id: true },
  });

  const conversationId =
    existingDm?.id ??
    (
      await prisma.directConversation.create({
        data: { isGroup: false, members: { create: dmPeers.map((userId) => ({ userId })) } },
        select: { id: true },
      })
    ).id;

  const dmCount = await prisma.message.count({ where: { conversationId } });
  if (dmCount === 0) {
    await prisma.message.create({
      data: {
        conversationId,
        authorId: created.get('phibi')!,
        content: 'hey, is it cool if I invite two friends to Friendos?',
        createdAt: at(offset + 2),
      },
    });
    await prisma.message.create({
      data: {
        conversationId,
        authorId: ownerId,
        content: 'of course, send them tetherchat.ru/invite/friendos',
        createdAt: at(offset + 3),
      },
    });
    await prisma.directConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: at(offset + 3) },
    });
  }

  console.info(`Done. Sign in as hoods@tetherchat.ru / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
