import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads .env from the API package and then the repository root, without adding a
 * dotenv dependency. Values already present in the real environment always win,
 * which is what makes the same image work in Docker (env vars) and locally (.env).
 */
const here = dirname(fileURLToPath(import.meta.url));

const candidates = [
  resolve(here, '../.env'),
  resolve(here, '../../.env'),
  resolve(here, '../../../.env'),
];

for (const file of candidates) {
  if (!existsSync(file)) continue;
  try {
    process.loadEnvFile(file);
  } catch {
    // Malformed or unreadable files are ignored; config validation reports the gap.
  }
}
