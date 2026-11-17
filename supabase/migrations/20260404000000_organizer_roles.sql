-- ==============================================================================
-- HackhIt — Organizer Roles & Authorization Model Migration
-- Version: 20260404000000
-- Description: Establishes a minimal, secure authorization model for hackathon organizers.
--              Maintains strict separation of privileges from student profiles.
--              Enforces Row-Level Security (RLS) so regular users cannot self-assign roles.
-- ==============================================================================

-- 1. ORGANIZER ROLES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizer_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'organizer' CHECK (role IN ('organizer', 'admin')),
  organization_name text,
  is_active boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. ENABLE ROW-LEVEL SECURITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.organizer_roles ENABLE ROW LEVEL SECURITY;

-- 3. RLS POLICIES
-- ------------------------------------------------------------------------------
-- Policy 1: Authenticated users can query only their own organizer role to verify status
DROP POLICY IF EXISTS "Users can view their own organizer role" ON public.organizer_roles;
CREATE POLICY "Users can view their own organizer role"
  ON public.organizer_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy 2: Mutations (INSERT, UPDATE, DELETE) are NOT allowed by regular users.
-- Only database administrators (service_role) or administrative functions can grant organizer roles.

-- 4. HELPER FUNCTION FOR DATABASE RLS INTEGRATION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_organizer(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizer_roles
    WHERE user_id = check_user_id
    AND is_active = true
  );
$$;

-- 5. PERFORMANCE INDEX
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_organizer_roles_user_active
  ON public.organizer_roles(user_id, is_active);
