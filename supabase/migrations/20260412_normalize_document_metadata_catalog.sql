create table if not exists public.document_metadata_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_metadata_schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_metadata_courses (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.document_metadata_schools(id) on delete cascade,
  code text not null,
  name text not null,
  academic_level text not null,
  max_semesters integer,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_metadata_courses_level_check
    check (academic_level in ('UG', 'PG', 'PhD', 'General', 'Integrated', 'Diploma')),
  constraint document_metadata_courses_unique_code_per_school unique (school_id, code)
);

create index if not exists idx_document_metadata_courses_school_id
  on public.document_metadata_courses (school_id);

create index if not exists idx_document_metadata_types_active
  on public.document_metadata_types (is_active);

create index if not exists idx_document_metadata_schools_active
  on public.document_metadata_schools (is_active);

create index if not exists idx_document_metadata_courses_active
  on public.document_metadata_courses (is_active);

create or replace function public.set_document_metadata_catalog_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_document_metadata_types_updated_at on public.document_metadata_types;
create trigger trg_document_metadata_types_updated_at
before update on public.document_metadata_types
for each row
execute procedure public.set_document_metadata_catalog_updated_at();

drop trigger if exists trg_document_metadata_schools_updated_at on public.document_metadata_schools;
create trigger trg_document_metadata_schools_updated_at
before update on public.document_metadata_schools
for each row
execute procedure public.set_document_metadata_catalog_updated_at();

drop trigger if exists trg_document_metadata_courses_updated_at on public.document_metadata_courses;
create trigger trg_document_metadata_courses_updated_at
before update on public.document_metadata_courses
for each row
execute procedure public.set_document_metadata_catalog_updated_at();

-- Backfill from legacy denormalized table when it exists.
do $$
declare
  legacy_code_column text;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'document_metadata_options'
  ) then
    legacy_code_column :=
      case
        when exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'document_metadata_options'
            and column_name = 'option_code'
        ) then 'option_code'
        when exists (
          select 1
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'document_metadata_options'
            and column_name = 'option_key'
        ) then 'option_key'
        else null
      end;

    if legacy_code_column is null then
      return;
    end if;

    execute format(
      $sql$
      insert into public.document_metadata_types (code, name, display_order, is_active)
      select
        %I,
        option_label,
        coalesce(sort_order, 0),
        coalesce(is_active, true)
      from public.document_metadata_options
      where option_type = 'document_type'
      on conflict (code)
      do update set
        name = excluded.name,
        display_order = excluded.display_order,
        is_active = excluded.is_active
      $sql$,
      legacy_code_column
    );

    execute format(
      $sql$
      insert into public.document_metadata_schools (code, name, display_order, is_active)
      select
        %I,
        option_label,
        coalesce(sort_order, 0),
        coalesce(is_active, true)
      from public.document_metadata_options
      where option_type = 'school'
      on conflict (code)
      do update set
        name = excluded.name,
        display_order = excluded.display_order,
        is_active = excluded.is_active
      $sql$,
      legacy_code_column
    );

    execute format(
      $sql$
      insert into public.document_metadata_courses (
        school_id,
        code,
        name,
        academic_level,
        max_semesters,
        display_order,
        is_active
      )
      select
        schools.id,
        courses.%I,
        courses.option_label,
        coalesce(courses.level, 'General'),
        courses.max_semesters,
        coalesce(courses.sort_order, 0),
        coalesce(courses.is_active, true)
      from public.document_metadata_options as courses
      join public.document_metadata_schools as schools
        on schools.code = courses.parent_key
      where courses.option_type = 'course'
      on conflict (school_id, code)
      do update set
        name = excluded.name,
        academic_level = excluded.academic_level,
        max_semesters = excluded.max_semesters,
        display_order = excluded.display_order,
        is_active = excluded.is_active
      $sql$,
      legacy_code_column
    );
  end if;
end
$$;
