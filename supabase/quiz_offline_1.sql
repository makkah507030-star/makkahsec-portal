-- =====================================================================
-- الاختبار دون إنترنت (mode = 'offline'، الجزء 1 من 4): النوع والجداول ودوال المعلم
-- نوع مستقل من الاختبارات: ينزّل الطالب الاختبار مشفّرًا في البيت، ويفتحه في الفصل بمفتاح يعرضه المعلم،
-- ويُسلّم برمز QR فيه إجاباته يمسحه المعلم فيُصحَّح هنا ويدخل كشف الرصد.
-- الحزمة يجهّزها متصفح المعلم ويشفّرها؛ لا تحوي الإجابات الصحيحة.
-- تكرار التنفيذ آمن.
-- =====================================================================

alter table public.quizzes drop constraint if exists quizzes_mode_check;
alter table public.quizzes
  add constraint quizzes_mode_check check (mode in ('omr', 'paper', 'online', 'external', 'offline'));

create table if not exists public.quiz_offline (
  quiz_id    uuid primary key references public.quizzes(id) on delete cascade,
  key        text not null,             -- مفتاح الفتح (يعرضه المعلم في الفصل)
  ver        integer not null default 1,
  package    text not null,             -- الأسئلة مشفّرة AES-GCM (base64)
  qids       uuid[] not null,           -- ترتيب الأسئلة في الحزمة لفك رمز الإجابات
  size_kb    integer,
  built_at   timestamptz not null default now()
);
alter table public.quiz_offline enable row level security;   -- الوصول عبر الدوال فقط

alter table public.quiz_assignments add column if not exists offline_token text;
alter table public.quiz_assignments add column if not exists offline_at timestamptz;
alter table public.quiz_assignments add column if not exists offline_info jsonb;

-- حفظ الحزمة (المعلم صاحب الاختبار). كل حفظ يرفع الإصدار، ومفتاح جديد يُبطل النسخ القديمة.
create or replace function public.quiz_offline_save(p_quiz uuid, p_key text, p_package text, p_qids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not exists (select 1 from quizzes where id = p_quiz and teacher_id = auth.uid()) then
    raise exception 'غير مصرّح: الاختبار ليس لك';
  end if;
  if not exists (select 1 from quizzes where id = p_quiz and mode = 'offline') then
    raise exception 'الاختبار ليس من نوع «دون إنترنت»';
  end if;
  if not exists (select 1 from quiz_online where quiz_id = p_quiz) then
    raise exception 'انشر الاختبار للطلاب أولًا';
  end if;
  if length(p_package) > 20000000 then raise exception 'حجم الاختبار كبير جدًا — صغّر الصور أو المقطع الصوتي'; end if;
  insert into quiz_offline (quiz_id, key, package, qids, size_kb)
  values (p_quiz, p_key, p_package, p_qids, length(p_package) / 1024)
  on conflict (quiz_id) do update
     set key = excluded.key, package = excluded.package, qids = excluded.qids,
         size_kb = excluded.size_kb, ver = quiz_offline.ver + 1, built_at = now()
  returning ver into v;
  return jsonb_build_object('ver', v);
end $$;

-- حالة النسخة دون إنترنت للمعلم: المفتاح، والإصدار، ومن نزّلها ومن رُصد
create or replace function public.quiz_offline_status(p_quiz uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare o quiz_offline%rowtype;
begin
  if not exists (select 1 from quizzes where id = p_quiz and teacher_id = auth.uid()) then
    raise exception 'غير مصرّح: الاختبار ليس لك';
  end if;
  select * into o from quiz_offline where quiz_id = p_quiz;
  if o.quiz_id is null then return null; end if;
  return jsonb_build_object(
    'key', o.key, 'ver', o.ver, 'built_at', o.built_at, 'size_kb', o.size_kb,
    'students', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', s.full_name, 'class_id', a.class_id,
        'downloaded', a.offline_at is not null and (a.offline_info->>'ver')::int = o.ver,
        'old', a.offline_at is not null and coalesce((a.offline_info->>'ver')::int, 0) <> o.ver,
        'submitted', a.submitted_at is not null,
        'scanned', a.offline_info ? 'scanned_at') order by s.full_name), '[]'::jsonb)
      from quiz_assignments a join students s on s.id = a.student_id where a.quiz_id = p_quiz));
end $$;

-- إيقاف النسخة دون إنترنت
create or replace function public.quiz_offline_delete(p_quiz uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from quizzes where id = p_quiz and teacher_id = auth.uid()) then
    raise exception 'غير مصرّح: الاختبار ليس لك';
  end if;
  delete from quiz_offline where quiz_id = p_quiz;
end $$;

revoke all on function public.quiz_offline_save(uuid, text, text, uuid[]) from public, anon;
revoke all on function public.quiz_offline_status(uuid) from public, anon;
revoke all on function public.quiz_offline_delete(uuid) from public, anon;
grant execute on function public.quiz_offline_save(uuid, text, text, uuid[]) to authenticated;
grant execute on function public.quiz_offline_status(uuid) to authenticated;
grant execute on function public.quiz_offline_delete(uuid) to authenticated;

-- نهاية الجزء 1
