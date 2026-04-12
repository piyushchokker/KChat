do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_metadata_options'
      and column_name = 'option_key'
  ) then
    alter table public.document_metadata_options
      rename column option_key to option_code;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'document_metadata_options'
      and constraint_name = 'document_metadata_options_unique_key'
  ) then
    alter table public.document_metadata_options
      rename constraint document_metadata_options_unique_key to document_metadata_options_unique_code;
  end if;
end
$$;
