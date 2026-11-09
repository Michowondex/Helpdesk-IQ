-- Add columns safely via DO block
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'incidents') THEN
        ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS escalation_tier INT NOT NULL DEFAULT 1;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'monitored_services') THEN
        ALTER TABLE public.monitored_services ADD COLUMN IF NOT EXISTS http_code INT;
        ALTER TABLE public.monitored_services ADD COLUMN IF NOT EXISTS last_error TEXT;
    END IF;
END $$;
