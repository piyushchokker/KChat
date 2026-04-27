-- Ticketing system hardening after initial rollout
-- Addresses advisor findings for function privileges/search_path and FK index coverage.

-- 1) Cover additional foreign keys for better write/delete performance.
CREATE INDEX IF NOT EXISTS idx_tickets_conversation_id
  ON public.tickets (conversation_id);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id
  ON public.ticket_messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_ticket_events_actor_id
  ON public.ticket_events (actor_id);

-- 2) Lock down SECURITY DEFINER helper functions.
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_app_user_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- 3) Pin trigger function search_path to avoid mutable search_path warning.
ALTER FUNCTION public.set_tickets_updated_at() SET search_path = public, pg_temp;
