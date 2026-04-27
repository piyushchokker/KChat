-- Production-grade ticketing schema extension
-- NOTE: This migration only adds new types/functions/tables/policies.

-- 1) Enum types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ticket_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ticket_priority' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'ticket_sender_type' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.ticket_sender_type AS ENUM ('student', 'admin', 'ai');
  END IF;
END;
$$;

-- 2) Tables
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  query text NOT NULL CHECK (length(btrim(query)) > 0),
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  category text,
  confidence_score double precision CHECK (
    confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
  ),
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CONSTRAINT tickets_resolved_at_check
    CHECK (resolved_at IS NULL OR status IN ('resolved', 'closed'))
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  sender_type public.ticket_sender_type NOT NULL,
  message text NOT NULL CHECK (length(btrim(message)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_messages_sender_check
    CHECK (
      (sender_type = 'ai' AND sender_id IS NULL)
      OR (sender_type IN ('student', 'admin') AND sender_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.ticket_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ticket_events_event_type_check
    CHECK (event_type IN ('created', 'assigned', 'resolved', 'reopened'))
);

CREATE TABLE IF NOT EXISTS public.resolved_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL CHECK (length(btrim(question)) > 0),
  answer text NOT NULL CHECK (length(btrim(answer)) > 0),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Indexes (required + additional operational indexes)
CREATE INDEX IF NOT EXISTS idx_tickets_user_id
  ON public.tickets (user_id);

CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON public.tickets (status);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id
  ON public.ticket_messages (ticket_id);

CREATE INDEX IF NOT EXISTS idx_tickets_created_at
  ON public.tickets (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to
  ON public.tickets (assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_created
  ON public.ticket_events (ticket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resolved_knowledge_ticket_id
  ON public.resolved_knowledge (ticket_id);

-- 4) Optional trigger for updated_at maintenance
CREATE OR REPLACE FUNCTION public.set_tickets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_updated_at ON public.tickets;

CREATE TRIGGER trg_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.set_tickets_updated_at();

-- 5) RLS helper functions
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id
  FROM public.users u
  WHERE u.auth_id = auth.uid()::text
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_id = auth.uid()::text
      AND u.role = 'admin'
      AND coalesce(u.is_allowed, true) = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated;

-- 6) Enable RLS on all new tables
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resolved_knowledge ENABLE ROW LEVEL SECURITY;

-- 7) RLS policies
-- Students can see only their own ticket graph.
-- Admin can see and manage all tickets.

-- tickets
DROP POLICY IF EXISTS tickets_select_own_or_admin ON public.tickets;
CREATE POLICY tickets_select_own_or_admin
  ON public.tickets
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = public.current_app_user_id()
  );

DROP POLICY IF EXISTS tickets_insert_own_or_admin ON public.tickets;
CREATE POLICY tickets_insert_own_or_admin
  ON public.tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_is_admin()
    OR (
      user_id = public.current_app_user_id()
      AND (
        conversation_id IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.conversations c
          WHERE c.id = conversation_id
            AND c.user_id = public.current_app_user_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS tickets_update_own_or_admin ON public.tickets;
CREATE POLICY tickets_update_own_or_admin
  ON public.tickets
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_is_admin()
    OR user_id = public.current_app_user_id()
  )
  WITH CHECK (
    public.current_user_is_admin()
    OR user_id = public.current_app_user_id()
  );

DROP POLICY IF EXISTS tickets_delete_admin_only ON public.tickets;
CREATE POLICY tickets_delete_admin_only
  ON public.tickets
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- ticket_messages
DROP POLICY IF EXISTS ticket_messages_select_ticket_scope ON public.ticket_messages;
CREATE POLICY ticket_messages_select_ticket_scope
  ON public.ticket_messages
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_id
        AND t.user_id = public.current_app_user_id()
    )
  );

DROP POLICY IF EXISTS ticket_messages_insert_ticket_scope ON public.ticket_messages;
CREATE POLICY ticket_messages_insert_ticket_scope
  ON public.ticket_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_is_admin()
    OR (
      sender_type = 'student'
      AND sender_id = public.current_app_user_id()
      AND EXISTS (
        SELECT 1
        FROM public.tickets t
        WHERE t.id = ticket_id
          AND t.user_id = public.current_app_user_id()
      )
    )
  );

DROP POLICY IF EXISTS ticket_messages_update_admin_only ON public.ticket_messages;
CREATE POLICY ticket_messages_update_admin_only
  ON public.ticket_messages
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS ticket_messages_delete_admin_only ON public.ticket_messages;
CREATE POLICY ticket_messages_delete_admin_only
  ON public.ticket_messages
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- ticket_events
DROP POLICY IF EXISTS ticket_events_select_ticket_scope ON public.ticket_events;
CREATE POLICY ticket_events_select_ticket_scope
  ON public.ticket_events
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_id
        AND t.user_id = public.current_app_user_id()
    )
  );

DROP POLICY IF EXISTS ticket_events_insert_admin_only ON public.ticket_events;
CREATE POLICY ticket_events_insert_admin_only
  ON public.ticket_events
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS ticket_events_update_admin_only ON public.ticket_events;
CREATE POLICY ticket_events_update_admin_only
  ON public.ticket_events
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS ticket_events_delete_admin_only ON public.ticket_events;
CREATE POLICY ticket_events_delete_admin_only
  ON public.ticket_events
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());

-- resolved_knowledge
DROP POLICY IF EXISTS resolved_knowledge_select_ticket_scope ON public.resolved_knowledge;
CREATE POLICY resolved_knowledge_select_ticket_scope
  ON public.resolved_knowledge
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.tickets t
      WHERE t.id = ticket_id
        AND t.user_id = public.current_app_user_id()
    )
  );

DROP POLICY IF EXISTS resolved_knowledge_insert_admin_only ON public.resolved_knowledge;
CREATE POLICY resolved_knowledge_insert_admin_only
  ON public.resolved_knowledge
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS resolved_knowledge_update_admin_only ON public.resolved_knowledge;
CREATE POLICY resolved_knowledge_update_admin_only
  ON public.resolved_knowledge
  FOR UPDATE
  TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS resolved_knowledge_delete_admin_only ON public.resolved_knowledge;
CREATE POLICY resolved_knowledge_delete_admin_only
  ON public.resolved_knowledge
  FOR DELETE
  TO authenticated
  USING (public.current_user_is_admin());
