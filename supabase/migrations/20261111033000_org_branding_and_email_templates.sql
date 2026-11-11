-- ============================================================
-- Migration: Add custom branding & email templates to organizations
-- Allows business tenants to set their custom logo URL and custom email wording
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS email_templates JSONB DEFAULT '{}'::jsonb;

