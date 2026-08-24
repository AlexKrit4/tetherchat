-- Full-text and substring search support for message history.
-- pg_trgm keeps the case-insensitive `contains` search used by the in-channel
-- search box from degrading into a sequential scan as history grows.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Message_content_trgm_idx"
  ON "Message" USING GIN (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Message_content_fts_idx"
  ON "Message" USING GIN (to_tsvector('simple', content));
