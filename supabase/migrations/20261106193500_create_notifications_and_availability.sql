-- Persistent In-App Notifications and Technician Availability Controls

-- 1. Create user_notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID,
    type TEXT NOT NULL DEFAULT 'system',
    ticket_id TEXT,
    incident_id TEXT,
    title TEXT NOT NULL,
    message TEXT,
    assigned_to TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at BIGINT NOT NULL
);

-- Indexes for lightning fast notification queries
CREATE INDEX IF NOT EXISTS idx_user_notif_org_user ON public.user_notifications(org_id, user_id, read);
CREATE INDEX IF NOT EXISTS idx_user_notif_created ON public.user_notifications(created_at DESC);

-- Enable RLS on user_notifications
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Non-recursive RLS policies for user_notifications
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'user_notifications' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_notifications', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "user_notifications_select"
    ON public.user_notifications FOR SELECT
    USING (
        org_id = public.current_user_org_id() 
        AND (user_id IS NULL OR user_id = auth.uid())
    );

CREATE POLICY "user_notifications_insert"
    ON public.user_notifications FOR INSERT
    WITH CHECK (
        org_id = public.current_user_org_id() OR auth.uid() IS NOT NULL
    );

CREATE POLICY "user_notifications_update"
    ON public.user_notifications FOR UPDATE
    USING (
        org_id = public.current_user_org_id()
    );

CREATE POLICY "user_notifications_delete"
    ON public.user_notifications FOR DELETE
    USING (
        org_id = public.current_user_org_id()
    );

-- 2. Add Technician Availability columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS away_reason TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS away_until BIGINT;

