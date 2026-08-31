-- pg_trgm backs the message search index created by the Prisma migration.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- A second database used by `npm test` in the API workspace.
SELECT 'CREATE DATABASE tetherchat_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tetherchat_test')\gexec
