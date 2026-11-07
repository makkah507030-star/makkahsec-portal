-- =====================================================================
-- شواهد الأداء الوظيفي: إلغاء شاهد لا يتوافق مع المتطلبات، بملاحظة للموظف.
-- • perf_reject(الشاهد، الملاحظة): لمدير المدرسة ووكيل الشؤون التعليمية والدعم الفني. يُنقل الشاهد إلى سجل
--   «الشواهد الملغاة» بملاحظته ومن ألغاه، ويخرج من الملف فلا يُحتسب، ويصل الموظف إشعار بالسبب.
-- • يرى الموظف شواهده الملغاة وملاحظاتها في ملفه، ويراها المقيّمون. الملف المرفوع يبقى محفوظًا.
-- تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.perf_evidence_rejected (
  id uuid primary key, teacher_user_id uuid not null, academic_year text not null, item_key text not null,
  source text, title text, file_path text, file_name text, event_date date, row jsonb not null,
  reject_note text not null, rejected_by uuid, rejected_by_name text, rejected_at timestamptz not null default now()
);
create index if not exists perf_evidence_rejected_owner on public.perf_evidence_rejected (teacher_user_id, academic_year);
alter table public.perf_evidence_rejected enable row level security;
drop policy if exists perf_rej_read on public.perf_evidence_rejected;
create policy perf_rej_read on public.perf_evidence_rejected for select to authenticated
  using (teacher_user_id = auth.uid() or public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']));
grant select on public.perf_evidence_rejected to authenticated;

create or replace function public.perf_reject(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare e perf_evidence; nid uuid; v_name text;
begin
  if not has_admin_role(array['principal', 'deputy_academic', 'tech_support']) then raise exception 'غير مصرّح'; end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'اكتب ملاحظة للموظف بسبب الإلغاء'; end if;
  select * into e from perf_evidence where id = p_id;
  if not found then raise exception 'الشاهد غير موجود'; end if;
  if e.teacher_user_id = auth.uid() then raise exception 'لا تُلغي شواهد ملفك بنفسك؛ احذفها من ملفك'; end if;
  select full_name into v_name from users where id = auth.uid();
  insert into perf_evidence_rejected (id, teacher_user_id, academic_year, item_key, source, title, file_path, file_name, event_date, row,
                                      reject_note, rejected_by, rejected_by_name)
  values (e.id, e.teacher_user_id, e.academic_year, e.item_key, e.source, e.title, e.file_path, e.file_name, e.event_date, to_jsonb(e),
          trim(p_note), auth.uid(), v_name)
  on conflict (id) do nothing;
  delete from perf_evidence where id = p_id;
  nid := public.send_notification('أُلغي شاهد من ملف أدائك الوظيفي', '«' || coalesce(e.title, '') || '»: ' || trim(p_note), 'general',
    case when e.item_key like 'l%' then '/lab-performance' when e.item_key like 'e%' then '/my-performance' else '/my-staff-performance' end,
    null, array[e.teacher_user_id], null, null, true);
  begin perform public.push_notification(nid); exception when others then null; end;
end $$;
revoke execute on function public.perf_reject(uuid, text) from public, anon;
grant execute on function public.perf_reject(uuid, text) to authenticated;
-- نهاية الجزء 1
