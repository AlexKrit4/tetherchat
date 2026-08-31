import type { FastifyRequest } from 'fastify';
import { ApiError } from '../errors.js';

export interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

/**
 * Reads a single multipart file into memory with an explicit byte ceiling and
 * mime allowlist. Uploads are small by design (10 MB), so buffering is fine and
 * avoids leaving temp files behind.
 */
export async function readMultipartFile(
  request: FastifyRequest,
  options: { maxBytes: number; allowedMime: readonly string[] },
): Promise<UploadedFile> {
  if (!request.isMultipart()) {
    throw ApiError.badRequest('Expected a multipart/form-data upload');
  }

  const part = await request.file({ limits: { fileSize: options.maxBytes, files: 1 } });
  if (!part) throw ApiError.badRequest('No file field found in the request');

  const buffer = await part.toBuffer().catch(() => {
    throw ApiError.payloadTooLarge(
      `File exceeds the ${Math.round(options.maxBytes / (1024 * 1024))} MB limit`,
    );
  });

  if (part.file.truncated || buffer.byteLength > options.maxBytes) {
    throw ApiError.payloadTooLarge(
      `File exceeds the ${Math.round(options.maxBytes / (1024 * 1024))} MB limit`,
    );
  }

  const mimetype = part.mimetype.split(';')[0].trim().toLowerCase();
  if (!options.allowedMime.includes(mimetype)) {
    throw ApiError.badRequest(`Unsupported file type: ${mimetype}`);
  }

  return { buffer, filename: part.filename || 'upload', mimetype };
}
