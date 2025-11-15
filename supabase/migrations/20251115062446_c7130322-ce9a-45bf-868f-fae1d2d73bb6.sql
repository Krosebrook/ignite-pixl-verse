-- Add brand_voice and name to brand_kits table
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS brand_voice TEXT NOT NULL DEFAULT 'Professional',
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Default Brand Kit';