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

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function deviceStorageKey(userId: string): string {
  return `tetherchat.e2ee.device.${userId}`;
}

export async function ensureE2eeDevice(userId: string): Promise<{ deviceId: string; pair: CryptoKeyPair }> {
  let deviceId = localStorage.getItem(deviceStorageKey(userId));
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(deviceStorageKey(userId), deviceId);
  }
  const identityId = `identity:${userId}:${deviceId}`;
  let pair = await readKey<CryptoKeyPair>(identityId);
  if (!pair) {
    pair = (await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      false,
      ['encrypt', 'decrypt'],
    )) as CryptoKeyPair;
    await writeKey(identityId, pair);
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
  const key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  await writeKey(storedId, key);
  return key;
}

export async function createSecretConversation(
  userId: string,
  friendId: string,
): Promise<DirectConversation> {
  await ensureE2eeDevice(userId);
  const [ownDevices, friendDevices] = await Promise.all([
    api.get<CryptoDevice[]>(`/api/e2ee/users/${userId}/devices`),
    api.get<CryptoDevice[]>(`/api/e2ee/users/${friendId}/devices`),
  ]);
  if (friendDevices.length === 0) {
    throw new Error('Друг должен обновить и открыть TetherChat перед созданием секретного чата');
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const raw = await crypto.subtle.exportKey('raw', key);
  const keys = await Promise.all(
    [...ownDevices, ...friendDevices].map(async (device) => {
      const publicKey = await crypto.subtle.importKey(
        'spki',
        base64ToBytes(device.publicKey),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt'],
      );
      return {
        deviceId: device.id,
        wrappedKey: bytesToBase64(
          await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw),
        ),
      };
    }),
  );
  const conversation = await api.post<DirectConversation>('/api/dms/secret', {
    userId: friendId,
    keys,
  });
  const localKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  await writeKey(`conversation:${userId}:${conversation.id}`, localKey);
  return conversation;
}

export async function encryptSecretMessage(
  userId: string,
  conversationId: string,
  content: string,
): Promise<{ version: 1; iv: string; ciphertext: string }> {
  const key = await conversationKey(userId, conversationId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
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
      { name: 'AES-GCM', iv: base64ToBytes(message.encrypted.iv) },
      key,
      base64ToBytes(message.encrypted.ciphertext),
    );
    return { ...message, content: new TextDecoder().decode(plaintext) };
  } catch {
    return { ...message, content: '🔒 Не удалось расшифровать сообщение' };
  }
}
