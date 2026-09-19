CREATE TABLE IF NOT EXISTS reading_positions (
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  page INTEGER NOT NULL CHECK (page >= 1 AND page <= 100000),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, book_id)
);
CREATE INDEX IF NOT EXISTS idx_reading_positions_user_updated
  ON reading_positions (user_id, updated_at DESC);
