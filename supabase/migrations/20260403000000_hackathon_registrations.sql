-- ==============================================================================
-- HackhIt — Hackathon Registrations Database Migration
-- Version: 20260403000000
-- Description: Creates public.hackathon_registrations table, unique constraints,
--              Row-Level Security (RLS) policies, indexes, and triggers.
-- Safe and repeatable: Idempotent operations, preserves all existing tables and data.
-- ==============================================================================

-- 1. HACKATHON REGISTRATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.hackathon_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hackathon_id uuid NOT NULL REFERENCES public.hackathons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  university text,
  participation_type text NOT NULL CHECK (participation_type IN ('individual', 'team')),
  team_name text,
  teammates jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed_eligibility boolean NOT NULL DEFAULT true,
  accepted_rules boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'withdrawn', 'waitlisted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent column additions if table already existed in a prior state
ALTER TABLE public.hackathon_registrations ADD COLUMN IF NOT EXISTS university text;
ALTER TABLE public.hackathon_registrations ADD COLUMN IF NOT EXISTS team_name text;
ALTER TABLE public.hackathon_registrations ADD COLUMN IF NOT EXISTS teammates jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.hackathon_registrations ADD COLUMN IF NOT EXISTS confirmed_eligibility boolean NOT NULL DEFAULT true;
ALTER TABLE public.hackathon_registrations ADD COLUMN IF NOT EXISTS accepted_rules boolean NOT NULL DEFAULT true;
ALTER TABLE public.hackathon_registrations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'registered';

-- Idempotent unique constraint: A user can only register once per hackathon
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_hackathon_user_registration'
  ) THEN
    ALTER TABLE public.hackathon_registrations
      ADD CONSTRAINT uq_hackathon_user_registration UNIQUE (hackathon_id, user_id);
  END IF;
END $$;

-- Idempotent check constraint: team_name required for teams, null or empty for individuals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_team_name_for_participation'
  ) THEN
    ALTER TABLE public.hackathon_registrations
      ADD CONSTRAINT chk_team_name_for_participation CHECK (
        (participation_type = 'individual' AND (team_name IS NULL OR length(trim(team_name)) = 0))
        OR (participation_type = 'team' AND team_name IS NOT NULL AND length(trim(team_name)) > 0)
      );
  END IF;
END $$;

-- 2. ENABLE ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.hackathon_registrations ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES
-- ------------------------------------------------------------------------------

-- Policy 1: Authenticated students can view their own registrations
DROP POLICY IF EXISTS "Students can view their own registrations" ON public.hackathon_registrations;
CREATE POLICY "Students can view their own registrations"
  ON public.hackathon_registrations FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Policy 2: Authenticated students can create their own registration (never trust client-supplied ID)
DROP POLICY IF EXISTS "Authenticated students can register for hackathons" ON public.hackathon_registrations;
CREATE POLICY "Authenticated students can register for hackathons"
  ON public.hackathon_registrations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- Policy 3: Authenticated students can update their own registration
DROP POLICY IF EXISTS "Students can update their own registrations" ON public.hackathon_registrations;
CREATE POLICY "Students can update their own registrations"
  ON public.hackathon_registrations FOR UPDATE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Policy 4: Authenticated students can delete / withdraw their own registration
DROP POLICY IF EXISTS "Students can withdraw their own registrations" ON public.hackathon_registrations;
CREATE POLICY "Students can withdraw their own registrations"
  ON public.hackathon_registrations FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Policy 5: Organizers can view registrations for hackathons they organized
DROP POLICY IF EXISTS "Organizers can view registrations for their hackathons" ON public.hackathon_registrations;
CREATE POLICY "Organizers can view registrations for their hackathons"
  ON public.hackathon_registrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hackathons h
      WHERE h.id = hackathon_registrations.hackathon_id
      AND h.organizer_id = auth.uid()
    )
  );

-- 4. PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_hackathon_registrations_hackathon ON public.hackathon_registrations(hackathon_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_registrations_user ON public.hackathon_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_hackathon_registrations_created_at ON public.hackathon_registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hackathon_registrations_status ON public.hackathon_registrations(status);

-- 5. UPDATED_AT TRIGGER FUNCTION & TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_hackathons_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_hackathon_registrations_updated ON public.hackathon_registrations;
CREATE TRIGGER on_hackathon_registrations_updated
  BEFORE UPDATE ON public.hackathon_registrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_hackathons_updated_at();

-- 6. REFRESH SCHEMA CACHE
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
