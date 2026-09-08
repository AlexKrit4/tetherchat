import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getConfig } from '../config.js';

export interface StoredFile {
  key: string;
  url: string;
}

export interface StoredObject {
  body: Buffer;
  contentType?: string;
}

export interface Storage {
  put(input: { body: Buffer; contentType: string; filename: string; prefix: string }): Promise<StoredFile>;
  get(key: string): Promise<StoredObject | null>;
  remove(key: string): Promise<void>;
}

/** Avatars, server icons and wallpapers stay publicly cacheable. Attachments do not. */
export const PUBLIC_STORAGE_PREFIXES = ['avatars/', 'icons/', 'wallpapers/'] as const;

export function isPublicStorageKey(key: string): boolean {
  return PUBLIC_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/**
 * Forwarded attachments reuse the original blob via
 * `${originalKey}#${messageId}:${attachmentId}` (storageKey is unique).
 * Reads must strip that suffix; deletes must not, or a forward would
 * unlink the source file.
 */
export function physicalStorageKey(key: string): string {
  const hash = key.indexOf('#');
  const raw = (hash === -1 ? key : key.slice(0, hash)).replaceAll('\\', '/');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Reject path traversal and absolute keys before touching the disk. */
export function isSafeStorageKey(key: string): boolean {
  const physical = physicalStorageKey(key);
  if (!physical || physical.includes('\0') || physical.startsWith('/') || physical.includes('://')) {
    return false;
  }
  return !physical.split('/').some((segment) => segment === '..' || segment === '');
}

function localObjectPath(root: string, key: string): string | null {
  if (!isSafeStorageKey(key)) return null;
  const target = resolve(root, physicalStorageKey(key));
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (target !== root && !target.startsWith(prefix)) return null;
  return target;
}

function safeExtension(filename: string, contentType: string): string {
  const ext = extname(filename).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext;
  const fallback: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
  };
  return fallback[contentType] ?? '.bin';
}

function buildKey(prefix: string, filename: string, contentType: string): string {
  const hash = createHash('sha1').update(randomUUID()).digest('hex').slice(0, 12);
  return `${prefix}/${Date.now()}-${hash}${safeExtension(filename, contentType)}`;
}

function publicUrlFor(key: string): string {
  const config = getConfig();
  if (config.STORAGE_DRIVER === 's3') {
    const base = config.S3_PUBLIC_URL ?? `${config.S3_ENDPOINT}/${config.S3_BUCKET}`;
    return `${base.replace(/\/$/, '')}/${key}`;
  }
  return `${config.PUBLIC_API_ORIGIN}/files/${key}`;
}

class LocalStorage implements Storage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  async put(input: { body: Buffer; contentType: string; filename: string; prefix: string }) {
    const key = buildKey(input.prefix, input.filename, input.contentType);
    const target = localObjectPath(this.root, key);
    if (!target) throw new Error('Refusing to write an unsafe storage key');
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, input.body);
    return { key, url: publicUrlFor(key) };
  }

  async get(key: string): Promise<StoredObject | null> {
    const target = localObjectPath(this.root, key);
    if (!target) return null;
    try {
      const body = await readFile(target);
      return { body };
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    // Forwarded copies share the original blob; their keys contain `#` so we
    // must not unlink the source when the copy is deleted.
    if (key.includes('#')) return;
    const target = localObjectPath(this.root, key);
    if (!target) return;
    await unlink(target).catch(() => undefined);
  }
}

class S3Storage implements Storage {
  private readonly client: S3Client;

  constructor() {
    const config = getConfig();
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      credentials:
        config.S3_ACCESS_KEY && config.S3_SECRET_KEY
          ? { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY }
          : undefined,
    });
  }

  async put(input: { body: Buffer; contentType: string; filename: string; prefix: string }) {
    const config = getConfig();
    const key = buildKey(input.prefix, input.filename, input.contentType);
    await this.client.send(
      new PutObjectCommand({
        Bucket: config.S3_BUCKET,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: isPublicStorageKey(key)
          ? 'public, max-age=31536000, immutable'
          : 'private, max-age=0, no-store',
      }),
    );
    return { key, url: publicUrlFor(key) };
  }

  async get(key: string): Promise<StoredObject | null> {
    const config = getConfig();
    const objectKey = physicalStorageKey(key);
    if (!objectKey) return null;
    try {
      const out = await this.client.send(
        new GetObjectCommand({
          Bucket: config.S3_BUCKET,
          Key: objectKey,
        }),
      );
      const bytes = await out.Body?.transformToByteArray();
      if (!bytes) return null;
      return { body: Buffer.from(bytes), contentType: out.ContentType };
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    if (key.includes('#')) return;
    const config = getConfig();
    await this.client
      .send(new DeleteObjectCommand({ Bucket: config.S3_BUCKET, Key: key }))
      .catch(() => undefined);
  }
}

let instance: Storage | null = null;

export function storage(): Storage {
  if (!instance) {
    const config = getConfig();
    instance = config.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage(config.STORAGE_LOCAL_DIR);
  }
  return instance;
}

export function resetStorage(): void {
  instance = null;
}
