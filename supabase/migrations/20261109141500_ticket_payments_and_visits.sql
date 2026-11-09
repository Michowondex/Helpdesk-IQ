-- ============================================================
-- Migration: Add payment and physical dispatch columns to tickets
-- ============================================================

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'FREE', -- 'FREE' | 'PAID' | 'REFUNDED'
  ADD COLUMN IF NOT EXISTS payment_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paystack_ref TEXT,
  ADD COLUMN IF NOT EXISTS support_type TEXT DEFAULT 'REMOTE', -- 'REMOTE' | 'PHYSICAL_VISIT'
  ADD COLUMN IF NOT EXISTS visit_address TEXT,
  ADD COLUMN IF NOT EXISTS visit_city TEXT,
  ADD COLUMN IF NOT EXISTS visit_scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_ref TEXT,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Index for payment tracking & disputes
CREATE INDEX IF NOT EXISTS idx_tickets_payment_status ON tickets (payment_status);
CREATE INDEX IF NOT EXISTS idx_tickets_paystack_ref ON tickets (paystack_ref);

