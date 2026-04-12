create table if not exists public.document_metadata_options (
  id uuid primary key default gen_random_uuid(),
  option_type text not null,
  option_code text not null,
  option_label text not null,
  parent_key text,
  level text,
  max_semesters integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_metadata_options_type_check
    check (option_type in ('document_type', 'school', 'course')),
  constraint document_metadata_options_course_parent_check
    check (
      (option_type = 'course' and parent_key is not null)
      or (option_type <> 'course' and parent_key is null)
    ),
  constraint document_metadata_options_unique_code unique (option_type, option_code)
);

create index if not exists idx_document_metadata_options_type
  on public.document_metadata_options (option_type);

create index if not exists idx_document_metadata_options_parent
  on public.document_metadata_options (parent_key);

create or replace function public.set_document_metadata_options_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_document_metadata_options_updated_at on public.document_metadata_options;

create trigger trg_document_metadata_options_updated_at
before update on public.document_metadata_options
for each row
execute procedure public.set_document_metadata_options_updated_at();
