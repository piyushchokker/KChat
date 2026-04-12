do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_metadata_courses'
      and column_name = 'code'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_metadata_courses'
      and column_name = 'course_code'
  ) then
    alter table public.document_metadata_courses
      rename column code to course_code;
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
      and column_name = 'code'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'document_metadata_schools'
      and column_name = 'course_key'
  ) then
    alter table public.document_metadata_schools
      rename column code to course_key;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'document_metadata_courses'
      and constraint_name = 'document_metadata_courses_unique_code_per_school'
  ) then
    alter table public.document_metadata_courses
      rename constraint document_metadata_courses_unique_code_per_school
      to document_metadata_courses_unique_course_code_per_school;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'document_metadata_schools'
      and constraint_name = 'document_metadata_schools_code_key'
  ) then
    alter table public.document_metadata_schools
      rename constraint document_metadata_schools_code_key
      to document_metadata_schools_course_key_key;
  end if;
end
$$;
