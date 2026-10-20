-- =====================================================================
-- معمل الحاسب الآلي (9): سجل التطبيقات العملية — سجل خاص بمعلمي الحاسب لكل فصل،
-- أعمدته «أعمال» تُنقل درجاتها من حصص المعمل (أو تُضاف يدويًا)، وخاناته تُعدَّل.
-- لكل فصل دراسي سجله (lab_term_key). يُنفَّذ بعد الأجزاء 1–8. تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.lab_works (
  id uuid primary key default gen_random_uuid(),
  lab_id smallint not null references public.labs(id),
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  term_key text not null,
  title text not null,
  max_mark numeric(5,1) not null check (max_mark > 0),
  session_id uuid references public.lab_sessions(id) on delete set null,   -- مصدر الدرجات
  work_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (teacher_id, session_id)
);
create table if not exists public.lab_work_marks (
  work_id uuid not null references public.lab_works(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  mark numeric(5,1) not null,
  manual boolean not null default false,     -- عدّلها المعلم: لا يستبدلها التحديث من المعمل
  updated_at timestamptz not null default now(),
  primary key (work_id, student_id)
);
alter table public.lab_works enable row level security;        -- بلا سياسات: الدوال وحدها
alter table public.lab_work_marks enable row level security;

-- هل يملك المستخدم هذا العمل (المعلم صاحبه، أو مسؤولو المعمل)
create or replace function public.lab_work_mine(p_work uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lab_works w where w.id = p_work
                  and (w.teacher_id = public.current_teacher_id() or public.lab_is_manager()));
$$;

-- السجل كاملًا لفصل في الفصل الدراسي الحالي: الأعمال والطلاب والدرجات،
-- وحصص المعلم لهذا الفصل التي لم تُنقل بعد
create or replace function public.lab_record(p_lab smallint, p_class uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  with w as (
    select * from public.lab_works
     where lab_id = p_lab and class_id = p_class and term_key = public.lab_term_key()
       and (teacher_id = public.current_teacher_id() or public.lab_is_manager())
  )
  select jsonb_build_object(
    'works', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'title', w.title, 'max', w.max_mark,
               'date', w.work_date, 'session', w.session_id) order by w.work_date, w.created_at) from w), '[]'),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.full_name) order by st.full_name)
               from public.student_enrollment e join public.students st on st.id = e.student_id
              where e.class_id = p_class and e.status = 'active'), '[]'),
    'marks', coalesce((select jsonb_agg(jsonb_build_object('w', m.work_id, 's', m.student_id, 'm', m.mark, 'manual', m.manual))
               from public.lab_work_marks m join w on w.id = m.work_id), '[]'),
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.lesson_title, 'at', s.created_at,
               'scanned', (select count(*) from public.lab_results r where r.session_id = s.id)) order by s.created_at desc)
               from public.lab_sessions s
              where s.lab_id = p_lab and s.class_id = p_class and s.created_by = auth.uid()
                and not exists (select 1 from w where w.session_id = s.id)), '[]'))
   where public.lab_can_view();
$$;

revoke execute on function public.lab_work_mine(uuid), public.lab_record(smallint, uuid) from public, anon;
grant execute on function public.lab_work_mine(uuid), public.lab_record(smallint, uuid) to authenticated;
-- نهاية الجزء 9
