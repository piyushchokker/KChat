do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'document_metadata_options'
  )
  and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'document_metadata_types'
  )
  and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'document_metadata_schools'
  )
  and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'document_metadata_courses'
  ) then
    drop trigger if exists trg_document_metadata_options_updated_at on public.document_metadata_options;
    drop table public.document_metadata_options;
  end if;
end
$$;

drop function if exists public.set_document_metadata_options_updated_at();
