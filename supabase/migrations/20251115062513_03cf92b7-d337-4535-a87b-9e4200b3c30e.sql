-- Add onboarding tracking to profiles
ALTER TABLE profiles
  ADD COLUMN onboarding_step INTEGER NOT NULL DEFAULT 0;