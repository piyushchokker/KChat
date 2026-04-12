drop index if exists public.idx_document_metadata_types_active;
drop index if exists public.idx_document_metadata_schools_active;
drop index if exists public.idx_document_metadata_courses_active;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_metadata_types'
      and column_name = 'is_active'
  ) then
    alter table public.document_metadata_types
      drop column is_active;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_metadata_schools'
      and column_name = 'is_active'
  ) then
    alter table public.document_metadata_schools
      drop column is_active;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_metadata_courses'
      and column_name = 'is_active'
  ) then
    alter table public.document_metadata_courses
      drop column is_active;
  end if;
end
$$;
