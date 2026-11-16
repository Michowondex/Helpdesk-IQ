-- Migration: Paystack subaccounts and payments table
-- Adds columns to organizations for Paystack subaccount settlement
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text,
  ADD COLUMN IF NOT EXISTS paystack_bank_name text,
  ADD COLUMN IF NOT EXISTS paystack_account_number text,
  ADD COLUMN IF NOT EXISTS paystack_account_name text,
  ADD COLUMN IF NOT EXISTS paystack_settlement_bank text;

-- Create payments table to track customer payments and server-side verification
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_email text NOT NULL,
  amount integer NOT NULL,
  reference text UNIQUE NOT NULL,
  status text DEFAULT 'pending',
  payment_type text NOT NULL,
  ticket_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_insert" ON public.payments;
DROP POLICY IF EXISTS "payments_select" ON public.payments;
DROP POLICY IF EXISTS "payments_update" ON public.payments;

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "payments_select" ON public.payments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE USING (true) WITH CHECK (true);

-- Enable realtime replication for payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- In case supabase_realtime publication is managed differently
    NULL;
END $$;
