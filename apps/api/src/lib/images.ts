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

/** Tiny blur placeholder for chat images, inlined as a data URL. */
export async function makeThumbnail(buffer: Buffer): Promise<string | null> {
  try {
    const webp = await sharp(buffer, { animated: false, failOn: 'none' })
      .rotate()
      .resize(32, 32, { fit: 'inside' })
      .webp({ quality: 40 })
      .toBuffer();
    if (webp.byteLength > 12_000) return null;
    return `data:image/webp;base64,${webp.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Chat wallpaper: wide, compressed, still sharp enough on a phone. */
export async function normalizeWallpaper(buffer: Buffer): Promise<{ body: Buffer; contentType: string }> {
  const body = await sharp(buffer, { animated: false })
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return { body, contentType: 'image/webp' };
}
