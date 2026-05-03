-- Auto-sync student profile fields from student_details using roll_number

create or replace function public.sync_users_from_student_details()
returns trigger
language plpgsql
as $$
declare
  v_roll text;
  v_student_name text;
  v_program text;
  v_school text;
begin
  -- Apply only to student rows.
  if coalesce(new.role, 'student') <> 'student' then
    return new;
  end if;

  -- Resolve roll number from explicit value first, then fallback to email prefix.
  v_roll := nullif(btrim(coalesce(new.roll_number, '')), '');

  if v_roll is null and new.email is not null and position('@' in new.email) > 1 then
    v_roll := nullif(btrim(split_part(new.email, '@', 1)), '');
  end if;

  if v_roll is null then
    return new;
  end if;

  -- Lookup in public.student_details. Table columns are source-style names.
  select
    nullif(btrim(sd."Student Name"), ''),
    nullif(btrim(sd."Program"), ''),
    nullif(btrim(sd."School"), '')
  into
    v_student_name,
    v_program,
    v_school
  from public.student_details sd
  where btrim(sd."Roll No."::text) = v_roll
  limit 1;

  if not found then
    return new;
  end if;

  -- Fill only missing fields so manual edits are preserved.
  if nullif(btrim(coalesce(new.name, '')), '') is null and v_student_name is not null then
    new.name := v_student_name;
  end if;

  if nullif(btrim(coalesce(new.program, '')), '') is null and v_program is not null then
    new.program := v_program;
  end if;

  if nullif(btrim(coalesce(new.course, '')), '') is null and v_program is not null then
    new.course := v_program;
  end if;

  if nullif(btrim(coalesce(new.school, '')), '') is null and v_school is not null then
    new.school := v_school;
  end if;

  if nullif(btrim(coalesce(new.department, '')), '') is null and v_school is not null then
    new.department := v_school;
  end if;

  if nullif(btrim(coalesce(new.roll_number, '')), '') is null then
    new.roll_number := v_roll;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_users_sync_from_student_details on public.users;

create trigger trg_users_sync_from_student_details
before insert or update of roll_number, email
on public.users
for each row
execute function public.sync_users_from_student_details();

