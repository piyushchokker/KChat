create table if not exists public.student_raised_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  student_name text not null,
  roll_number text,
  student_course text,
  raised_ticket text not null,
  raised_at timestamptz not null default now(),
  resolved_answer text,
  answered_by uuid references public.users(id) on delete set null,
  answered_at timestamptz,
  valid_from timestamptz,
  valid_till timestamptz,
  no_expiry boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_raised_tickets_validity_range_check
    check (
      no_expiry = true
      or (valid_from is null and valid_till is null)
      or (valid_from is not null and valid_till is not null and valid_till >= valid_from)
    ),
  constraint student_raised_tickets_answered_at_check
    check (resolved_answer is null or answered_at is not null)
);

create index if not exists idx_student_raised_tickets_student
  on public.student_raised_tickets (student_id);

create index if not exists idx_student_raised_tickets_created
  on public.student_raised_tickets (raised_at desc);

create index if not exists idx_student_raised_tickets_expiry
  on public.student_raised_tickets (valid_till)
  where no_expiry = false and valid_till is not null;

create or replace function public.set_student_raised_tickets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_student_raised_tickets_updated_at on public.student_raised_tickets;

create trigger trg_student_raised_tickets_updated_at
before update on public.student_raised_tickets
for each row
execute procedure public.set_student_raised_tickets_updated_at();
