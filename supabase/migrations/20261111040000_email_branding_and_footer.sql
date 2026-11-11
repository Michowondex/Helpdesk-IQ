-- ============================================================
-- Migration: Add email branding & email footer configuration to organizations
-- Supports Header Banner, Watermark Logo, Sending Team, Hotline, and Legal Disclaimers
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS email_branding JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS email_footer JSONB DEFAULT '{}'::jsonb;
