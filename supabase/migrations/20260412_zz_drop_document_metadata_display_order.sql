do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_metadata_types'
      and column_name = 'display_order'
  ) then
    alter table public.document_metadata_types
      drop column display_order;
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
      and column_name = 'display_order'
  ) then
    alter table public.document_metadata_schools
      drop column display_order;
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
      and column_name = 'display_order'
  ) then
    alter table public.document_metadata_courses
      drop column display_order;
  end if;
end
$$;
