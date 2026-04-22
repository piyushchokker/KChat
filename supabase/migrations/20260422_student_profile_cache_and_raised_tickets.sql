alter table public.users
  add column if not exists course text,
  add column if not exists school text;

create table if not exists public.student_profile_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  auth_id text not null,
  roll_number text not null,
  student_name text,
  student_email text,
  course text,
  school text,
  department text,
  raw_details jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_student_profile_cache_roll_number
  on public.student_profile_cache (roll_number);

create index if not exists idx_student_profile_cache_auth_id
  on public.student_profile_cache (auth_id);

create table if not exists public.raised_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  student_name text not null,
  student_email text,
  roll_number text,
  student_course text,
  student_school text,
  query text not null,
  cache_layer text,
  status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  raised_at timestamptz not null default now(),
  resolved_answer text,
  answered_by uuid references public.users(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_raised_tickets_user_id
  on public.raised_tickets (user_id);

create index if not exists idx_raised_tickets_status
  on public.raised_tickets (status);

create index if not exists idx_raised_tickets_raised_at
  on public.raised_tickets (raised_at desc);

create or replace function public.set_student_profile_cache_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_student_profile_cache_updated_at on public.student_profile_cache;

create trigger trg_student_profile_cache_updated_at
before update on public.student_profile_cache
for each row
execute procedure public.set_student_profile_cache_updated_at();

create or replace function public.set_raised_tickets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_raised_tickets_updated_at on public.raised_tickets;

create trigger trg_raised_tickets_updated_at
before update on public.raised_tickets
for each row
execute procedure public.set_raised_tickets_updated_at();
