-- ملف المعلم الرقمي (الجزء 7): ملاحظة الزائر واسمه في سجل الزوار، ورسالة المعلم للمشاركة عبر واتساب.
-- • dfile_visits.note: يكتبها الزائر للمعلم من صفحة الملف، ويعدّلها خلال يوم من زيارته.
--   يراها المعلم صاحب الملف (والمدير والدعم الفني) بسياسة القراءة نفسها في الجزء 5.
-- • teacher_dfiles.share_msg: الكلمة الترحيبية التي يرسلها المعلم مع البطاقة والرابط.
-- يُنفَّذ بعد الجزء 5. تكرار التنفيذ آمن.

alter table public.dfile_visits add column if not exists note text;
alter table public.dfile_visits add column if not exists note_at timestamptz;
alter table public.teacher_dfiles add column if not exists share_msg text;

-- الزائر يعرف معرّف زيارته وحده (يعود له من dfile_visit_start)، فلا يكتب على زيارة غيره
create or replace function public.dfile_visit_note(p_id uuid, p_note text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare n text := nullif(left(trim(coalesce(p_note, '')), 1000), '');
begin
  update public.dfile_visits set note = n, note_at = case when n is null then null else now() end
   where id = p_id and started_at > now() - interval '1 day';
  return found;
end; $$;

-- اسم الزائر وجهته بعد بدء الزيارة: الملف يظهر أولًا، ويعرّف الزائر بنفسه متى شاء
create or replace function public.dfile_visit_who(p_id uuid, p_name text, p_org text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  update public.dfile_visits
     set visitor_name = nullif(left(trim(coalesce(p_name, '')), 80), ''),
         visitor_org  = nullif(left(trim(coalesce(p_org, '')), 80), '')
   where id = p_id and started_at > now() - interval '1 day';
  return found;
end; $$;

revoke execute on function public.dfile_visit_note(uuid, text) from public;
revoke execute on function public.dfile_visit_who(uuid, text, text) from public;
grant  execute on function public.dfile_visit_note(uuid, text) to anon, authenticated;
grant  execute on function public.dfile_visit_who(uuid, text, text) to anon, authenticated;
-- نهاية الجزء 7
