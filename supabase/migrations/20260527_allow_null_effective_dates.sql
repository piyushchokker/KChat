-- Allow storing NULL effective dates for "always valid" documents.
-- The API still accepts NOEXPIRY but stores NULLs when possible.

alter table if exists public.documents
  alter column effective_from drop not null;

alter table if exists public.documents
  alter column effective_till drop not null;

