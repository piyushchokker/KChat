-- Speed up first-login student lookup by roll number
create index if not exists idx_student_details_roll_no
  on public.student_details ("Roll No.");

