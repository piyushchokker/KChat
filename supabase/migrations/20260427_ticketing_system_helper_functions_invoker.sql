-- Convert ticketing RLS helper functions from SECURITY DEFINER to SECURITY INVOKER.
-- This keeps RLS behavior while reducing definer-function exposure warnings.

ALTER FUNCTION public.current_app_user_id() SECURITY INVOKER;
ALTER FUNCTION public.current_user_is_admin() SECURITY INVOKER;

-- Keep execute scoped to signed-in and service roles.
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO service_role;
