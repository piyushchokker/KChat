-- Cached queries table (Excel cache / query log)

create table if not exists public.cached_quries (
  id uuid primary key default gen_random_uuid(),
  query text not null check (length(btrim(query)) > 0),
  answer text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cached_quries_created_at
  on public.cached_quries (created_at desc);

create index if not exists idx_cached_quries_created_by
  on public.cached_quries (created_by)
  where created_by is not null;

create or replace function public.set_cached_quries_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cached_quries_updated_at on public.cached_quries;

create trigger trg_cached_quries_updated_at
before update on public.cached_quries
for each row
execute procedure public.set_cached_quries_updated_at();

