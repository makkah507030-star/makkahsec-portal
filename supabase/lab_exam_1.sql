-- مركز اختبارات التقنية الرقمية (1 من 1): الاختبارات النهائية النظرية والعملية لمعمل الحاسب، وبنك الأسئلة.
-- منفصل عن اختبارات البوابة العامة. الدرجات تُرصد في «سجل التطبيقات» (lab_works) عملًا لكل فصل.
-- يُنفَّذ بعد computer_lab_1..13. تكرار التنفيذ آمن.

create table if not exists public.lab_exams (
  id uuid primary key default gen_random_uuid(),
  lab_id smallint not null references public.labs(id),
  teacher_id uuid not null default public.current_teacher_id() references public.teachers(id) on delete cascade,
  term_key text not null default public.lab_term_key(),
  kind text not null check (kind in ('theory', 'practical')),
  grade int not null check (grade between 1 and 3),
  title text not null check (length(trim(title)) > 0),
  total numeric(5,1) not null check (total > 0),
  duration int,                                  -- بالدقائق
  code text not null unique,                     -- رمز الاختبار في ملف المعمل ورموز النتائج
  secret text not null,                          -- مفتاح توقيع النتائج
  open_key text not null,                        -- مفتاح الفتح يُعرض على السبورة
  body jsonb not null default '{}',              -- الأسئلة بإجاباتها ودرجاتها، أو مهام العملي وسلّمه
  classes uuid[] not null default '{}',
  works jsonb not null default '{}',             -- { class_id: lab_work_id } في سجل التطبيقات
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lab_exams_teacher on public.lab_exams (teacher_id, created_at desc);

create table if not exists public.lab_exam_subs (
  exam_id uuid not null references public.lab_exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  answers jsonb,                                 -- إجابات النظري، أو درجات المعايير في العملي
  score numeric(5,1),
  detail jsonb,                                  -- مصدر كل جزء: device | paper | rubric، والنموذج والجهاز
  absent boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (exam_id, student_id)
);

-- تعديلات بنك الأسئلة: سؤال من الدروس معدّل أو مخفي (qid = معرّف السؤال)، أو سؤال مضاف (custom)
create table if not exists public.lab_qbank (
  qid text primary key,
  grade int not null,
  unit int,
  lesson text,
  custom boolean not null default false,
  hidden boolean not null default false,
  data jsonb not null default '{}',
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);

create or replace function public.lab_exam_mine(p_exam uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lab_exams e where e.id = p_exam
                  and (e.teacher_id = public.current_teacher_id() or public.lab_is_manager()));
$$;
revoke execute on function public.lab_exam_mine(uuid) from public, anon;
grant execute on function public.lab_exam_mine(uuid) to authenticated;

alter table public.lab_exams enable row level security;
alter table public.lab_exam_subs enable row level security;
alter table public.lab_qbank enable row level security;

drop policy if exists lab_exams_read on public.lab_exams;
create policy lab_exams_read on public.lab_exams for select to authenticated
  using (teacher_id = public.current_teacher_id() or public.lab_is_manager());
drop policy if exists lab_exams_add on public.lab_exams;
create policy lab_exams_add on public.lab_exams for insert to authenticated
  with check (teacher_id = public.current_teacher_id() and public.lab_can_book());
drop policy if exists lab_exams_edit on public.lab_exams;
create policy lab_exams_edit on public.lab_exams for update to authenticated
  using (teacher_id = public.current_teacher_id()) with check (teacher_id = public.current_teacher_id());
drop policy if exists lab_exams_del on public.lab_exams;
create policy lab_exams_del on public.lab_exams for delete to authenticated using (teacher_id = public.current_teacher_id());

drop policy if exists lab_exam_subs_all on public.lab_exam_subs;
create policy lab_exam_subs_all on public.lab_exam_subs for all to authenticated
  using (public.lab_exam_mine(exam_id)) with check (public.lab_exam_mine(exam_id));

drop policy if exists lab_qbank_read on public.lab_qbank;
create policy lab_qbank_read on public.lab_qbank for select to authenticated using (public.lab_can_view());
drop policy if exists lab_qbank_write on public.lab_qbank;
create policy lab_qbank_write on public.lab_qbank for all to authenticated
  using (public.lab_can_book() or public.lab_is_manager()) with check (public.lab_can_book() or public.lab_is_manager());

grant select, insert, update, delete on public.lab_exams, public.lab_exam_subs, public.lab_qbank to authenticated;

-- للتحقق
select (select count(*) from public.lab_exams) as "الاختبارات", (select count(*) from public.lab_qbank) as "تعديلات البنك";
-- نهاية الجزء 1
