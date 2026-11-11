-- ============================================================
-- Migration: Add MFA enforcement and ticket settlement columns
-- ============================================================

-- Add enforce_mfa to organizations
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS enforce_mfa BOOLEAN DEFAULT FALSE;

-- Add resolution settlement tracking columns to tickets
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settlement_status TEXT, -- 'CONFIRM_RESOLVED' | 'FULL_REFUND' | 'PARTIAL_REFUND'
  ADD COLUMN IF NOT EXISTS settlement_note TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_settlement_status ON tickets (settlement_status);
