-- ============================================================
-- Migration: Add custom IT contact channels to organizations
-- Allows business admins to set custom Teams link, Slack/Chat link,
-- or their own internal WhatsApp link for their staff.
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS support_chat_link TEXT,
  ADD COLUMN IF NOT EXISTS support_whatsapp TEXT;

