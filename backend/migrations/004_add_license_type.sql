-- Add license_type to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS license_type VARCHAR(50) DEFAULT NULL;

-- Optional: create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_license_type ON users(license_type);
