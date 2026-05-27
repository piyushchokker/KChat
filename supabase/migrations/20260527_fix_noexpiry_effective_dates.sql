-- Ensure NOEXPIRY documents can store NULL effective dates.
-- This migration removes NOT NULL/default constraints and backfills legacy sentinel values to NULL.

alter table if exists public.documents
  alter column effective_from drop not null,
  alter column effective_till drop not null,
  alter column effective_from drop default,
  alter column effective_till drop default;

-- Backfill old sentinel values used for "always valid" documents.
update public.documents
set
  effective_from = null,
  effective_till = null
where
  effective_from = '1900-01-01'
  and effective_till = '9999-12-31';

