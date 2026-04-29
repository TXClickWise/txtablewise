-- Platform-wide system admins (separate from per-restaurant roles)
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Security definer helper to check if a user is a platform/system admin
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
  );
$$;

-- Only system admins can read/manage the table (assignment is done via SQL)
DROP POLICY IF EXISTS "system admins read platform_admins" ON public.platform_admins;
CREATE POLICY "system admins read platform_admins"
ON public.platform_admins
FOR SELECT
TO authenticated
USING (public.is_system_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS "system admins write platform_admins" ON public.platform_admins;
CREATE POLICY "system admins write platform_admins"
ON public.platform_admins
FOR ALL
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());