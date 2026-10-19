-- =====================================================================
-- معمل الحاسب الآلي (7): حصص الدروس ودرجات الطلاب. يُنشئ المعلم «ملف حصة» لفصل ودرس،
-- فيعمل على أجهزة المعمل دون إنترنت، ويُظهر لكل طالب رمز QR بدرجته موقّعًا بمفتاح
-- الحصة، فيمسحه المعلم ويُرصد هنا. يُنفَّذ بعد الأجزاء 1–6. تكرار التنفيذ آمن.
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.lab_sessions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                 -- رمز قصير في رمز QR
  lab_id smallint not null references public.labs(id),
  class_id uuid not null references public.classes(id) on delete cascade,
  lesson_id text not null,
  lesson_title text not null,
  secret text not null,                      -- مفتاح التوقيع، لا يُقرأ إلا عبر الدوال
  roster jsonb not null,                     -- معرّفات الطلاب بترتيبهم في الملف
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.lab_sessions enable row level security;   -- بلا سياسة قراءة: الدوال وحدها

create table if not exists public.lab_results (
  session_id uuid not null references public.lab_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  device_seat integer,                       -- الجهاز الذي أُدّي عليه الدرس
  map_seat integer,                          -- جهازه في خريطة الجلوس وقت الرصد
  quiz integer, mastery integer, done integer, total integer,
  scanned_by uuid default auth.uid(),
  scanned_at timestamptz not null default now(),
  primary key (session_id, student_id)
);
alter table public.lab_results enable row level security;
drop policy if exists "lab results read" on public.lab_results;
create policy "lab results read" on public.lab_results for select to authenticated using (public.lab_can_view());

-- بيانات ملف الحصة: الرمز والمفتاح والطلاب (الاسم والجهاز فقط، بلا معرّفات)
create or replace function public.lab_session_file(p_session uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', s.code, 'secret', s.secret, 'lesson', s.lesson_id,
           'class_no', c.class_no, 'grade', c.grade, 'device_count',
           (select count(*) from public.lab_devices d where d.lab_id = s.lab_id),
           'roster', (select jsonb_agg(jsonb_build_object('n', st.full_name, 's', ls.seat_no) order by r.i)
                        from jsonb_array_elements_text(s.roster) with ordinality r(id, i)
                        join public.students st on st.id = r.id::uuid
                        left join public.lab_seats ls on ls.lab_id = s.lab_id and ls.class_id = s.class_id and ls.student_id = st.id))
    from public.lab_sessions s join public.classes c on c.id = s.class_id
   where s.id = p_session and (s.created_by = auth.uid() or public.lab_is_manager());
$$;

create or replace function public.lab_session_create(p_lab smallint, p_class uuid, p_lesson text, p_title text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_code text;
begin
  if not (public.lab_can_book() or public.lab_is_manager()) then raise exception 'غير مخوّل بإنشاء حصص المعمل'; end if;
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from public.lab_sessions where code = v_code);
  end loop;
  insert into public.lab_sessions (code, lab_id, class_id, lesson_id, lesson_title, secret, roster)
  select v_code, p_lab, p_class, p_lesson, p_title, encode(extensions.gen_random_bytes(16), 'hex'),
         coalesce(jsonb_agg(st.id order by st.full_name), '[]')
    from public.student_enrollment e join public.students st on st.id = e.student_id
   where e.class_id = p_class and e.status = 'active'
  returning id into v_id;
  return public.lab_session_file(v_id) || jsonb_build_object('id', v_id);
end $$;

-- حصص المعلم (وكل الحصص للمحضر والإدارة) مع عدد من رُصدت درجته
create or replace function public.lab_sessions_list(p_lab smallint)
returns table (id uuid, code text, class_no integer, grade integer, lesson_title text, created_at timestamptz,
               teacher text, students integer, scanned integer)
language sql stable security definer set search_path = public as $$
  select s.id, s.code, c.class_no, c.grade, s.lesson_title, s.created_at,
         (select t.full_name from public.teachers t where t.user_id = s.created_by limit 1),
         jsonb_array_length(s.roster), (select count(*)::int from public.lab_results r where r.session_id = s.id)
    from public.lab_sessions s join public.classes c on c.id = s.class_id
   where s.lab_id = p_lab and (s.created_by = auth.uid() or public.lab_is_manager())
   order by s.created_at desc limit 60;
$$;

create or replace function public.lab_session_delete(p_session uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.lab_sessions where id = p_session and (created_by = auth.uid() or public.lab_is_manager());
$$;
-- نهاية الجزء 7
