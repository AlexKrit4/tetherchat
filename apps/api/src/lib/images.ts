import sharp from 'sharp';

export interface ImageInfo {
  width: number | null;
  height: number | null;
}

export async function readImageInfo(buffer: Buffer): Promise<ImageInfo> {
  try {
    const metadata = await sharp(buffer).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/** Avatars are normalised to a 256px square webp so member lists stay cheap. */
export async function normalizeAvatar(buffer: Buffer): Promise<{ body: Buffer; contentType: string }> {
  const body = await sharp(buffer, { animated: true })
    .resize(256, 256, { fit: 'cover', position: 'centre' })
    .webp({ quality: 88 })
    .toBuffer();
  return { body, contentType: 'image/webp' };
}

/** Server icons keep the same treatment at 128px. */
export async function normalizeIcon(buffer: Buffer): Promise<{ body: Buffer; contentType: string }> {
  const body = await sharp(buffer, { animated: true })
    .resize(128, 128, { fit: 'cover', position: 'centre' })
    .webp({ quality: 88 })
    .toBuffer();
  return { body, contentType: 'image/webp' };
}
