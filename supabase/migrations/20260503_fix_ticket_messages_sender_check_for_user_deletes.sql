-- Allow historical ticket messages to remain valid when sender user is deleted.
-- `sender_id` can become NULL due to FK `ON DELETE SET NULL`.

alter table public.ticket_messages
  drop constraint if exists ticket_messages_sender_check;

alter table public.ticket_messages
  add constraint ticket_messages_sender_check
  check (
    sender_type <> 'ai'::public.ticket_sender_type
    or sender_id is null
  );
