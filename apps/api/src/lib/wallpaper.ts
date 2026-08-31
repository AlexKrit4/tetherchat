import type { FastifyRequest } from 'fastify';
import { ALLOWED_AVATAR_MIME, LIMITS } from '@tetherchat/shared';
import { normalizeWallpaper } from './images.js';
import { readMultipartFile } from './multipart.js';
import { storage } from './storage.js';

export async function readWallpaperUpload(request: FastifyRequest, userId: string): Promise<string> {
  const file = await readMultipartFile(request, {
    maxBytes: LIMITS.avatarBytes,
    allowedMime: ALLOWED_AVATAR_MIME,
  });
  const normalized = await normalizeWallpaper(file.buffer);
  const stored = await storage().put({
    body: normalized.body,
    contentType: normalized.contentType,
    filename: 'wallpaper.webp',
    prefix: `wallpapers/${userId}`,
  });
  return stored.url;
}
