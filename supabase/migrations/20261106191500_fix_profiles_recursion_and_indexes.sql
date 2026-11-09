-- 1. Helper SECURITY DEFINER functions to prevent RLS recursion
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Drop recursive policies on profiles if they exist and recreate clean ones
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Clean, non-recursive RLS policies for profiles:
-- Users can always view and update their own profile
CREATE POLICY "profiles_select_own" 
  ON public.profiles FOR SELECT 
  USING (id = auth.uid() OR org_id = public.current_user_org_id());

CREATE POLICY "profiles_update_own" 
  ON public.profiles FOR UPDATE 
  USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" 
  ON public.profiles FOR INSERT 
  WITH CHECK (id = auth.uid());

-- 3. Check and add performance indexes safely using DO block
DO $$
BEGIN
    -- org_id indexes
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'org_id') THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_org_id ON public.tickets(org_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'created') THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_created ON public.tickets(created DESC);
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON public.tickets(created_at DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tickets' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'org_id') THEN
        CREATE INDEX IF NOT EXISTS idx_incidents_org_id ON public.incidents(org_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'opened_at') THEN
        CREATE INDEX IF NOT EXISTS idx_incidents_opened_at ON public.incidents(opened_at DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emails' AND column_name = 'org_id') THEN
        CREATE INDEX IF NOT EXISTS idx_emails_org_id ON public.emails(org_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'emails' AND column_name = 'sent_at') THEN
        CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON public.emails(sent_at DESC);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_base' AND column_name = 'org_id') THEN
        CREATE INDEX IF NOT EXISTS idx_knowledge_base_org_id ON public.knowledge_base(org_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'monitored_services' AND column_name = 'org_id') THEN
        CREATE INDEX IF NOT EXISTS idx_monitored_services_org_id ON public.monitored_services(org_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'org_id') THEN
        CREATE INDEX IF NOT EXISTS idx_teams_org_id ON public.teams(org_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'org_id') THEN
        CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'domain') THEN
        CREATE INDEX IF NOT EXISTS idx_organizations_domain ON public.organizations(domain);
    END IF;
END $$;

