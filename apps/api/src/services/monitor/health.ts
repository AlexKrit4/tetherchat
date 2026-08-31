import { statfs } from 'node:fs/promises';
import { connect } from 'node:net';
import { prisma } from '../../db.js';
import { redis } from '../../redis.js';

type DiskInfo = {
  path: string;
  totalGb: number;
  usedGb: number;
  freeGb: number;
  usedPercent: number;
};

function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (days > 0) return `${days}д ${hours}ч ${minutes}м`;
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function diskBar(percent: number): string {
  const filled = Math.min(10, Math.max(0, Math.round(percent / 10)));
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
}

async function readDisk(path: string): Promise<DiskInfo | null> {
  try {
    const stats = await statfs(path);
    const total = Number(stats.bsize) * Number(stats.blocks);
    const free = Number(stats.bsize) * Number(stats.bfree);
    const used = total - free;
    const usedPercent = total > 0 ? (used / total) * 100 : 0;
    return {
      path,
      totalGb: total / 1_000_000_000,
      usedGb: used / 1_000_000_000,
      freeGb: free / 1_000_000_000,
      usedPercent,
    };
  } catch {
    return null;
  }
}

async function dockerHttpGet(path: string, socketPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    const request = `GET ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`;
    let raw = '';
    socket.setTimeout(10_000);
    socket.on('data', (chunk) => {
      raw += chunk.toString();
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('docker socket timeout'));
    });
    socket.on('error', reject);
    socket.on('end', () => {
      const split = raw.indexOf('\r\n\r\n');
      resolve(split >= 0 ? raw.slice(split + 4) : raw);
    });
    socket.write(request);
  });
}

type DockerContainer = {
  Names?: string[];
  State?: string;
  Status?: string;
};

async function listDockerContainers(): Promise<string> {
  const socketPath = process.env.MONITOR_DOCKER_SOCKET ?? '/var/run/docker.sock';
  try {
    const body = await dockerHttpGet('/containers/json?all=0', socketPath);
    const parsed = JSON.parse(body) as DockerContainer[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return 'Нет запущенных контейнеров';
    }
    return parsed
      .map((row) => {
        const name = row.Names?.[0]?.replace(/^\//, '') ?? 'unknown';
        return `${name}\t${row.Status ?? row.State ?? 'unknown'}`;
      })
      .join('\n');
  } catch (error) {
    return `Docker недоступен (${error instanceof Error ? error.message : 'ошибка'}). Смонтируйте /var/run/docker.sock в api.`;
  }
}

async function probeHttp(url: string): Promise<{ ok: boolean; ms: number; body?: string }> {
  const started = Date.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const body = await response.text();
    return { ok: response.ok, ms: Date.now() - started, body: body.slice(0, 200) };
  } catch {
    return { ok: false, ms: Date.now() - started };
  }
}

export async function formatDiskReport(): Promise<string> {
  const diskPaths = (process.env.MONITOR_DISK_PATHS ?? '/host,/')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const disks = (await Promise.all(diskPaths.map(readDisk))).filter(Boolean) as DiskInfo[];

  if (disks.length === 0) {
    return '**💾 Диск**\n\nНе удалось прочитать диск. Проверьте MONITOR_DISK_PATHS и монтирование /host в api.';
  }

  const lines = ['**💾 Диск**', ''];
  for (const disk of disks) {
    const warn = disk.usedPercent >= 85 ? ' ⚠️' : '';
    lines.push(
      `\`${disk.path}\`${warn}`,
      `${diskBar(disk.usedPercent)} **${disk.usedPercent.toFixed(1)}%**`,
      `занято: ${disk.usedGb.toFixed(1)} GB / ${disk.totalGb.toFixed(1)} GB`,
      `свободно: **${disk.freeGb.toFixed(1)} GB**`,
      '',
    );
  }
  return lines.join('\n').trim();
}

export async function formatDockerReport(): Promise<string> {
  const containers = await listDockerContainers();
  return `**🐳 Docker**\n\n\`\`\`\n${containers}\n\`\`\``;
}

export async function formatApiReport(): Promise<string> {
  const url = process.env.MONITOR_HEALTH_URL ?? 'http://127.0.0.1:4000/api/health';
  const health = await probeHttp(url);
  const lines = ['**🔌 API**', ''];
  if (health.ok) {
    lines.push(`✅ ${url}`);
    lines.push(`Время ответа: **${health.ms} ms**`);
    if (health.body) lines.push(`Ответ: \`${health.body}\``);
  } else {
    lines.push(`❌ ${url} (${health.ms} ms)`);
  }
  return lines.join('\n');
}

export async function formatStatusReport(): Promise<string> {
  const mem = process.memoryUsage();
  const uptimeSec = process.uptime();

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  let redisOk = false;
  try {
    redisOk = (await redis.ping()) === 'PONG';
  } catch {
    redisOk = false;
  }

  const health = await probeHttp(process.env.MONITOR_HEALTH_URL ?? 'http://127.0.0.1:4000/api/health');
  const disk = await formatDiskReport();
  const docker = await formatDockerReport();

  const lines = [
    '**📊 Статус сервера TetherChat**',
    '',
    `⏱ Uptime API: **${formatDuration(uptimeSec)}**`,
    `💾 RAM процесса: **${formatMb(mem.rss)}** (heap ${formatMb(mem.heapUsed)})`,
    `🗄 Postgres: ${dbOk ? '✅ OK' : '❌ FAIL'}`,
    `🔴 Redis: ${redisOk ? '✅ OK' : '❌ FAIL'}`,
    `🔌 Health: ${health.ok ? `✅ OK (${health.ms} ms)` : '❌ FAIL'}`,
    '',
    disk,
    '',
    docker,
  ];

  return lines.join('\n');
}

export async function formatIntegrityReport(): Promise<string> {
  const disk = await formatDiskReport();
  const api = await formatApiReport();
  const docker = await formatDockerReport();
  return ['**🛡 Проверка целостности**', '', api, '', disk, '', docker].join('\n');
}
