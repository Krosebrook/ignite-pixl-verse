-- Add timezone and locale to orgs table
ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en-US';