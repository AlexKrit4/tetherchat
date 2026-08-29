import type { CryptoDevice, DirectConversation, Message } from '@tetherchat/shared';
import { api } from '@/lib/api';

const DB_NAME = 'tetherchat-e2ee';
const STORE_NAME = 'keys';

type StoredValue = CryptoKey | CryptoKeyPair;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readKey<T extends StoredValue>(id: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function writeKey(id: string, value: StoredValue): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(value, id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function deviceStorageKey(userId: string): string {
  return `tetherchat.e2ee.device.${userId}`;
}

export function getE2eeDeviceId(userId: string): string | null {
  return localStorage.getItem(deviceStorageKey(userId));
}

export async function ensureE2eeDevice(userId: string): Promise<{ deviceId: string; pair: CryptoKeyPair }> {
  let deviceId = localStorage.getItem(deviceStorageKey(userId));
  const hadDeviceId = Boolean(deviceId);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(deviceStorageKey(userId), deviceId);
  }
  const identityId = `identity:${userId}:${deviceId}`;
  let pair = await readKey<CryptoKeyPair>(identityId);
  if (!pair && hadDeviceId) {
    await api.delete(`/api/e2ee/devices/${deviceId}`).catch(() => undefined);
    deviceId = crypto.randomUUID();
    localStorage.setItem(deviceStorageKey(userId), deviceId);
  }
  if (!pair) {
    pair = (await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-1',
      },
      false,
      ['encrypt', 'decrypt'],
    )) as CryptoKeyPair;
    await writeKey(`identity:${userId}:${deviceId}`, pair);
  }
  const publicKey = bytesToBase64(await crypto.subtle.exportKey('spki', pair.publicKey));
  await api.post('/api/e2ee/devices', {
    deviceId,
    name: `${navigator.platform || 'Web'} · ${navigator.userAgent.includes('Mobile') ? 'Web mobile' : 'Web'}`,
    publicKey,
  });
  return { deviceId, pair };
}

async function conversationKey(userId: string, conversationId: string): Promise<CryptoKey> {
  const storedId = `conversation:${userId}:${conversationId}`;
  const stored = await readKey<CryptoKey>(storedId);
  if (stored) return stored;

  const { deviceId, pair } = await ensureE2eeDevice(userId);
  const bundle = await api.get<{ wrappedKey: string }>(
    `/api/e2ee/conversations/${conversationId}/key/${deviceId}`,
  );
  const raw = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    pair.privateKey,
    base64ToBytes(bundle.wrappedKey),
  );
  const key = await importConversationAesKey(raw);
  await writeKey(storedId, key);
  return key;
}

/**
 * AES keys must remain extractable: after a peer claims the secret chat we
 * wrap this raw key to their device public key. A non-extractable CryptoKey
 * makes `exportKey('raw')` throw, so the claim is never fulfilled.
 */
export async function importConversationAesKey(raw: BufferSource): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

export async function createSecretConversation(
  userId: string,
  friendId: string,
): Promise<DirectConversation> {
  const { deviceId } = await ensureE2eeDevice(userId);
  const [ownDevices, friendDevices] = await Promise.all([
    api.get<CryptoDevice[]>(`/api/e2ee/users/${userId}/devices`),
    api.get<CryptoDevice[]>(`/api/e2ee/users/${friendId}/devices`),
  ]);
  if (friendDevices.length === 0) {
    throw new Error('Друг должен обновить и открыть TetherChat перед созданием секретного чата');
  }
  for (const device of friendDevices) {
    const pinId = `tetherchat.e2ee.pinned.${friendId}.${device.id}`;
    const pinned = localStorage.getItem(pinId);
    if (pinned && pinned !== device.publicKey) {
      throw new Error('Ключ устройства друга изменился. Создание чата остановлено для безопасности.');
    }
    localStorage.setItem(pinId, device.publicKey);
  }
  const ownDevice = ownDevices.find((row) => row.id === deviceId);
  if (!ownDevice) throw new Error('Device not registered');

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const raw = await crypto.subtle.exportKey('raw', key);
  const publicKey = await crypto.subtle.importKey(
    'spki',
    base64ToBytes(ownDevice.publicKey),
    { name: 'RSA-OAEP', hash: 'SHA-1' },
    false,
    ['encrypt'],
  );
  const conversation = await api.post<DirectConversation>('/api/dms/secret', {
    userId: friendId,
    keys: [
      {
        deviceId: ownDevice.id,
        wrappedKey: bytesToBase64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw)),
      },
    ],
  });
  const localKey = await importConversationAesKey(raw);
  await writeKey(`conversation:${userId}:${conversation.id}`, localKey);
  return conversation;
}

export async function claimSecretConversation(userId: string, conversationId: string): Promise<void> {
  const { deviceId } = await ensureE2eeDevice(userId);
  await api.post(`/api/e2ee/conversations/${conversationId}/claim`, { deviceId });
}

export async function deliverSecretKey(
  conversationId: string,
  deviceId: string,
  wrappedKey: string,
): Promise<void> {
  await api.post(`/api/e2ee/conversations/${conversationId}/deliver-key`, { deviceId, wrappedKey });
}

export async function processPendingSecretClaims(userId: string): Promise<void> {
  const claims = await api.get<Array<{ conversationId: string; userId: string; deviceId: string }>>(
    '/api/e2ee/conversations/pending-claims',
  );
  for (const claim of claims) {
    try {
      const storedId = `conversation:${userId}:${claim.conversationId}`;
      const stored = await readKey<CryptoKey>(storedId);
      if (!stored) continue;
      const raw = await crypto.subtle.exportKey('raw', stored);
      const friendDevice = await api
        .get<CryptoDevice[]>(`/api/e2ee/users/${claim.userId}/devices`)
        .then((rows) => rows.find((row) => row.id === claim.deviceId));
      if (!friendDevice) continue;
      const publicKey = await crypto.subtle.importKey(
        'spki',
        base64ToBytes(friendDevice.publicKey),
        { name: 'RSA-OAEP', hash: 'SHA-1' },
        false,
        ['encrypt'],
      );
      const wrappedKey = bytesToBase64(await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw));
      await deliverSecretKey(claim.conversationId, claim.deviceId, wrappedKey);
    } catch {
      // One failed claim must not block wrapping keys for the remaining chats.
    }
  }
}

export async function waitForSecretKey(userId: string, conversationId: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await conversationKey(userId, conversationId);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Timed out waiting for secret key');
}

export async function encryptSecretMessage(
  userId: string,
  conversationId: string,
  content: string,
): Promise<{ version: 1; iv: string; ciphertext: string }> {
  const key = await conversationKey(userId, conversationId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(conversationId) },
    key,
    new TextEncoder().encode(content),
  );
  return { version: 1, iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext) };
}

export async function decryptSecretMessage(userId: string, message: Message): Promise<Message> {
  if (!message.encrypted) return message;
  try {
    const key = await conversationKey(userId, message.channelId);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: base64ToBytes(message.encrypted.iv),
        additionalData: new TextEncoder().encode(message.channelId),
      },
      key,
      base64ToBytes(message.encrypted.ciphertext),
    );
    return { ...message, content: new TextDecoder().decode(plaintext) };
  } catch {
    return { ...message, content: '🔒 Не удалось расшифровать сообщение' };
  }
}

export async function getSecretSafetyNumber(userId: string, friendId: string): Promise<string> {
  const [ownDevices, friendDevices] = await Promise.all([
    api.get<CryptoDevice[]>(`/api/e2ee/users/${userId}/devices`),
    api.get<CryptoDevice[]>(`/api/e2ee/users/${friendId}/devices`),
  ]);
  const canonical = [...ownDevices, ...friendDevices]
    .map((device) => `${device.userId}:${device.id}:${device.publicKey}`)
    .sort()
    .join('|');
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical)),
  );
  const code = Array.from(hash.slice(0, 15))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .match(/.{1,5}/g)!
    .join(' ');
  const lines = await Promise.all(
    [...ownDevices.map((device) => ['Ваше', device] as const), ...friendDevices.map((device) => ['Друг', device] as const)]
      .map(async ([owner, device]) => {
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', base64ToBytes(device.publicKey)));
        const fingerprint = Array.from(digest.slice(0, 8))
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
        return `${owner}: ${device.name ?? device.id} · ${fingerprint}`;
      }),
  );
  return `${code}\n\nУстройства:\n${lines.join('\n')}`;
}
