CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'hardcoded-user',
  name TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('json', 'lottie')),
  raw_json TEXT NOT NULL,
  metadata JSONB NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  frame_rate REAL NOT NULL,
  duration_seconds REAL NOT NULL,
  layer_count INTEGER NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets (user_id);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_content_hash ON assets (content_hash);
