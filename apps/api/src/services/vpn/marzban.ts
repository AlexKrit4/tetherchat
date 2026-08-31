import { randomUUID } from 'node:crypto';
import { getVpnConfig } from './config.js';

export interface ProvisionedClient {
  username: string;
  uuid: string;
  nodeId: string;
  links: string[];
}

const mockStore = new Map<string, { links: string[]; expire: number }>();

export function linksToSubscriptionBody(links: string[]): string {
  return Buffer.from(links.join('\n'), 'utf8').toString('base64');
}

export function toUnix(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

async function login(): Promise<string> {
  const cfg = getVpnConfig();
  const body = new URLSearchParams({
    username: cfg.marzbanUsername,
    password: cfg.marzbanPassword,
  });
  const resp = await fetch(`${cfg.marzbanUrl.replace(/\/$/, '')}/api/admin/token`, {
    method: 'POST',
    body,
  });
  if (!resp.ok) throw new Error(`Marzban login failed: ${resp.status}`);
  const data = (await resp.json()) as { access_token: string };
  return data.access_token;
}

export async function createMarzbanUser(input: {
  username: string;
  expireTs: number;
  dataLimitBytes: number | null;
  note?: string;
}): Promise<ProvisionedClient> {
  const cfg = getVpnConfig();
  if (cfg.marzbanMock) {
    const uuid = randomUUID();
    const link =
      `vless://${uuid}@127.0.0.1:443?encryption=none&flow=xtls-rprx-vision&security=reality` +
      `&sni=www.cloudflare.com&fp=chrome&pbk=MOCK_PUBLIC_KEY&sid=0123456789abcdef&type=tcp#Enigma`;
    mockStore.set(input.username, { links: [link], expire: input.expireTs });
    return { username: input.username, uuid, nodeId: cfg.vpnNodeId, links: [link] };
  }

  const token = await login();
  const resp = await fetch(`${cfg.marzbanUrl.replace(/\/$/, '')}/api/user`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      username: input.username,
      proxies: { vless: { flow: 'xtls-rprx-vision' } },
      inbounds: { vless: ['VLESS TCP REALITY'] },
      expire: input.expireTs,
      data_limit: input.dataLimitBytes ?? 0,
      data_limit_reset_strategy: 'no_reset',
      status: 'active',
      note: input.note ?? '',
    }),
  });
  if (!resp.ok) throw new Error(`Marzban create failed: ${resp.status} ${await resp.text()}`);
  const data = (await resp.json()) as {
    links?: string[];
    proxies?: { vless?: { id?: string } };
  };
  const links = data.links ?? [];
  const uuid = data.proxies?.vless?.id ?? randomUUID();
  return { username: input.username, uuid, nodeId: cfg.vpnNodeId, links };
}

export async function modifyMarzbanUser(
  username: string,
  input: { expireTs?: number; status?: string; dataLimitBytes?: number | null },
): Promise<void> {
  const cfg = getVpnConfig();
  if (cfg.marzbanMock) {
    const entry = mockStore.get(username);
    if (!entry) return;
    if (input.expireTs !== undefined) entry.expire = input.expireTs;
    return;
  }

  const token = await login();
  const payload: Record<string, unknown> = {};
  if (input.expireTs !== undefined) payload.expire = input.expireTs;
  if (input.status !== undefined) payload.status = input.status;
  if (input.dataLimitBytes !== undefined) payload.data_limit = input.dataLimitBytes ?? 0;
  const resp = await fetch(`${cfg.marzbanUrl.replace(/\/$/, '')}/api/user/${username}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Marzban modify failed: ${resp.status}`);
}

export async function getMarzbanLinks(username: string): Promise<string[]> {
  const cfg = getVpnConfig();
  if (cfg.marzbanMock) return mockStore.get(username)?.links ?? [];

  const token = await login();
  const resp = await fetch(`${cfg.marzbanUrl.replace(/\/$/, '')}/api/user/${username}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) return [];
  const data = (await resp.json()) as { links?: string[] };
  return data.links ?? [];
}
