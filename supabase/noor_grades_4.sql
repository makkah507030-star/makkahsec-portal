-- =====================================================================
-- متابعة رصد الدرجات في نور — الجزء 4: الحالة لكل (فترة، فصل، مادة) من الجدول الدراسي.
-- كانت الحالة مربوطة بخانة اختبار في «جداول الاختبارات»، فلا يظهر إلا ما له خانة.
-- صارت لكل فصل ومادة في الجدول الدراسي كما في كشف نور، والحالات السابقة تُنقل.
-- يُنفَّذ بعد الأجزاء 1–3، وتكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.noor_grade_marks (
  exam_term_id uuid not null,
  class_id uuid not null,
  subject_id uuid not null,
  status text not null check (status in ('done', 'partial')),
  note text,
  updated_by uuid default auth.uid(),
  updated_name text,
  updated_at timestamptz not null default now(),
  primary key (exam_term_id, class_id, subject_id)
);

alter table public.noor_grade_marks enable row level security;

drop policy if exists noor_grade_marks_manage on public.noor_grade_marks;
create policy noor_grade_marks_manage on public.noor_grade_marks as PERMISSIVE for ALL to authenticated
  using (public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']))
  with check (public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']));

-- نقل ما سُجّل سابقًا على خانات الاختبار
insert into public.noor_grade_marks (exam_term_id, class_id, subject_id, status, note, updated_by, updated_name, updated_at)
select s.exam_term_id, s.class_id, s.subject_id, e.status, e.note, e.updated_by, e.updated_name, e.updated_at
  from public.noor_grade_entries e
  join public.exam_slots s on s.id = e.exam_slot_id
 where s.class_id is not null and s.subject_id is not null
on conflict do nothing;

-- تسجيل الحالة لفصل أو عدة فصول دفعة واحدة. none = حذف (لم يرصد).
-- p_items: [{"class_id": "...", "subject_id": "..."}, ...]
create or replace function public.noor_grade_set(p_term uuid, p_items jsonb, p_status text,
                                                 p_note text default null, p_name text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not has_admin_role(array['principal', 'deputy_academic', 'tech_support']) then
    raise exception 'غير مصرح';
  end if;
  if p_status = 'none' then
    delete from noor_grade_marks m
     using jsonb_to_recordset(p_items) as x(class_id uuid, subject_id uuid)
     where m.exam_term_id = p_term and m.class_id = x.class_id and m.subject_id = x.subject_id;
  elsif p_status in ('done', 'partial') then
    insert into noor_grade_marks as m (exam_term_id, class_id, subject_id, status, note, updated_name)
    select p_term, x.class_id, x.subject_id, p_status,
           case when p_status = 'partial' then nullif(trim(p_note), '') end, p_name
      from jsonb_to_recordset(p_items) as x(class_id uuid, subject_id uuid)
    on conflict (exam_term_id, class_id, subject_id) do update
       set status = excluded.status, note = excluded.note, updated_by = auth.uid(),
           updated_name = excluded.updated_name, updated_at = now();
  else
    raise exception 'حالة غير معروفة';
  end if;
end;
$$;

grant execute on function public.noor_grade_set(uuid, jsonb, text, text, text) to authenticated;

-- نهاية الجزء 4
