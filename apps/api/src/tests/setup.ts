/**
 * Integration tests run against a real Postgres and Redis, because the parts
 * worth testing here (permission resolution, cascades, unique constraints,
 * rate limiting) live in the database layer rather than above it.
 *
 * TEST_DATABASE_URL points at a throwaway database; DATABASE_URL is used as a
 * fallback so a local `.env` is enough to run them.
 */
import '../loadEnv.js';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdef';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789abcdef';
process.env.ENABLE_WORKERS = 'false';
process.env.ENABLE_LINK_PREVIEWS = 'false';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR ??= './.test-uploads';
process.env.LOG_LEVEL = 'silent';
