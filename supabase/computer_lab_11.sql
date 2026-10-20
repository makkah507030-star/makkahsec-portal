-- =====================================================================
-- معمل الحاسب الآلي (11): الملف الدائم ورمز الحصة. يُثبَّت على أجهزة المعمل ملف واحد
-- فيه كل الدروس وكل الفصول (لقطة من الطلاب والجلوس)، ويفتح المعلم الحصة برمز من 5 أرقام
-- يعرضه على السبورة، فيتحقق منه الملف دون إنترنت. يُنفَّذ بعد الأجزاء 1–10. تكرار التنفيذ آمن.
-- رمز الحصة = أول 7 حروف من HMAC-SHA256('ROOM|التاريخ|رقم الفصل|الدرس') بمفتاح الملف، باقي 100000.
-- =====================================================================
create table if not exists public.lab_installs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  lab_id smallint not null references public.labs(id),
  secret text not null,
  pin_hash text not null,                    -- بصمة رمز المعلم (تُحسب في المتصفح)
  classes jsonb not null,                    -- [{class_id, students: [معرّفات بترتيب الملف]}]
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.lab_installs enable row level security;     -- بلا سياسات: الدوال وحدها
alter table public.lab_sessions add column if not exists install_id uuid references public.lab_installs(id) on delete cascade,
  add column if not exists room_date date, add column if not exists class_idx integer;
create unique index if not exists lab_sessions_room on public.lab_sessions (install_id, class_id, lesson_id, room_date) where install_id is not null;

create or replace function public.lab_room_code(p_secret text, p_date date, p_idx integer, p_lesson text) returns text
language sql immutable set search_path = public, extensions as $$
  select lpad(((('x' || left(encode(hmac('ROOM|' || to_char(p_date, 'YYYY-MM-DD') || '|' || p_idx || '|' || p_lesson,
                p_secret, 'sha256'), 'hex'), 7))::bit(28)::int) % 100000)::text, 5, '0');
$$;

-- بيانات الملف الدائم (آخر إصدار للمعمل): الفصول بأسماء طلابها وأجهزتهم الحالية
create or replace function public.lab_install_file(p_lab smallint)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('mode', 'install', 'code', i.code, 'secret', i.secret, 'pin', i.pin_hash,
           'created', i.created_at, 'device_count', (select count(*) from public.lab_devices d where d.lab_id = i.lab_id),
           'classes', (select jsonb_agg(jsonb_build_object('no', c.class_no, 'grade', c.grade,
               'roster', (select coalesce(jsonb_agg(jsonb_build_object('n', st.full_name, 's', ls.seat_no) order by r.k), '[]')
                            from jsonb_array_elements_text(x.v->'students') with ordinality r(id, k)
                            join public.students st on st.id = r.id::uuid
                            left join public.lab_seats ls on ls.lab_id = i.lab_id and ls.class_id = c.id and ls.student_id = st.id))
               order by x.n)
             from jsonb_array_elements(i.classes) with ordinality x(v, n) join public.classes c on c.id = (x.v->>'class_id')::uuid))
    from public.lab_installs i
   where i.lab_id = p_lab and (public.lab_can_book() or public.lab_is_manager())
   order by i.created_at desc limit 1;
$$;

-- إصدار ملف دائم جديد (يلزم نسخه إلى كل الأجهزة بعده)
create or replace function public.lab_install_create(p_lab smallint, p_pin_hash text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
begin
  if not (public.lab_can_book() or public.lab_is_manager()) then raise exception 'غير مخوّل'; end if;
  insert into public.lab_installs (code, lab_id, secret, pin_hash, classes)
  select upper(substr(md5(gen_random_uuid()::text), 1, 8)), p_lab, encode(gen_random_bytes(16), 'hex'), p_pin_hash,
         coalesce(jsonb_agg(jsonb_build_object('class_id', c.id, 'students',
           (select coalesce(jsonb_agg(st.id order by st.full_name), '[]') from public.student_enrollment e
              join public.students st on st.id = e.student_id where e.class_id = c.id and e.status = 'active'))
           order by c.class_no), '[]')
    from public.classes c
   where c.is_active and c.academic_year = (select value from public.settings where key = 'active_year');
  return public.lab_install_file(p_lab);
end $$;

-- فتح حصة اليوم بالملف الدائم: رمز الحصة، وسجلّها في lab_sessions لرصد النتائج
create or replace function public.lab_room_open(p_lab smallint, p_class uuid, p_lesson text, p_title text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare i public.lab_installs; v_idx integer; v_day date := (now() at time zone 'Asia/Riyadh')::date; v_sid uuid;
begin
  if not (public.lab_can_book() or public.lab_is_manager()) then raise exception 'غير مخوّل'; end if;
  select * into i from public.lab_installs where lab_id = p_lab order by created_at desc limit 1;
  if i.id is null then raise exception 'لم يُصدَر ملف المعمل الدائم بعد'; end if;
  select n - 1 into v_idx from jsonb_array_elements(i.classes) with ordinality x(v, n) where (x.v->>'class_id')::uuid = p_class;
  if v_idx is null then raise exception 'الفصل ليس في ملف المعمل الحالي — أصدر ملفًا جديدًا'; end if;
  insert into public.lab_sessions (code, lab_id, class_id, lesson_id, lesson_title, secret, roster, install_id, room_date, class_idx)
  values (upper(substr(md5(gen_random_uuid()::text), 1, 8)), p_lab, p_class, p_lesson, p_title, i.secret,
          i.classes -> v_idx -> 'students', i.id, v_day, v_idx)
  on conflict (install_id, class_id, lesson_id, room_date) where install_id is not null do update set lesson_title = excluded.lesson_title
  returning id into v_sid;
  return jsonb_build_object('room', public.lab_room_code(i.secret, v_day, v_idx, p_lesson), 'session', v_sid, 'date', v_day);
end $$;

revoke execute on function public.lab_install_file(smallint), public.lab_install_create(smallint, text),
  public.lab_room_open(smallint, uuid, text, text), public.lab_room_code(text, date, integer, text) from public, anon;
grant execute on function public.lab_install_file(smallint), public.lab_install_create(smallint, text),
  public.lab_room_open(smallint, uuid, text, text) to authenticated;
-- نهاية الجزء 11
