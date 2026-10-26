-- احتساب شهادة الحضور تلقائيًا في ملف شواهد المنسوب فور صدورها باسمه.
-- شهادة «حضور — ورشة تدريبية» ← البند e02_02 «حضور البرامج التدريبية» (بند سجل:
-- كل شهادة سجلٌّ مستقل). لا يحتاج المنسوب إرسالًا يدويًا؛ ويبقى الزر اليدوي متاحًا
-- لبقية الشهادات. شغّله في Supabase ← SQL Editor، وتكراره آمن. (يسري فورًا بلا نشر.)

-- خريطة: مفتاح الشهادة ← بند الأداء الذي تُحتسب عليه تلقائيًا
create table if not exists public.cert_auto_evidence (
  template_key text primary key,
  item_key     text not null,
  is_active    boolean not null default true
);
insert into public.cert_auto_evidence (template_key, item_key) values ('training_attendance', 'e02_02')
on conflict (template_key) do update set item_key = excluded.item_key, is_active = true;

alter table public.cert_auto_evidence enable row level security;
drop policy if exists cert_auto_read on public.cert_auto_evidence;
create policy cert_auto_read on public.cert_auto_evidence for select to authenticated using (true);

-- المحفّز: عند صدور شهادة مربوطة باسم مستلِم بحساب، تُضاف لملف شواهده
create or replace function public.cert_auto_to_file()
returns trigger language plpgsql security definer set search_path = public as $$
declare ikey text; rec boolean; yr text;
begin
  if new.recipient_user_id is null then return new; end if;
  if new.status not in ('issued', 'approved') then return new; end if;
  if tg_op = 'UPDATE' and old.status in ('issued', 'approved') then return new; end if;

  select m.item_key into ikey
    from public.cert_auto_evidence m
    join public.form_templates t on t.key = m.template_key
   where t.id = new.template_id and m.is_active;
  if ikey is null then return new; end if;

  select is_record into rec from public.perf_items where key = ikey and is_active;
  if rec is null then return new; end if;

  select value into yr from public.settings where key = 'active_year';
  yr := coalesce(nullif(yr, ''), to_char(now(), 'YYYY'));

  -- لا تُضف الشهادة نفسها مرتين
  if exists (select 1 from public.perf_evidence
              where teacher_user_id = new.recipient_user_id and item_key = ikey
                and new.id = any(form_docs)) then
    return new;
  end if;

  if rec then
    insert into public.perf_evidence (teacher_user_id, academic_year, item_key, source, title,
                                      form_document_id, form_docs, event_date)
    values (new.recipient_user_id, yr, ikey, 'form', new.title || ' · ' || new.serial,
            new.id, array[new.id], new.created_at::date);
  else
    update public.perf_evidence
       set use_count = use_count + 1, form_docs = form_docs || new.id, last_used_at = now()
     where teacher_user_id = new.recipient_user_id and academic_year = yr and item_key = ikey;
    if not found then
      insert into public.perf_evidence (teacher_user_id, academic_year, item_key, source, title,
                                        form_document_id, form_docs, event_date)
      values (new.recipient_user_id, yr, ikey, 'form', new.title || ' · ' || new.serial,
              new.id, array[new.id], new.created_at::date);
    end if;
  end if;
  return new;
end $$;

drop trigger if exists cert_auto_to_file on public.form_documents;
create trigger cert_auto_to_file after insert or update of status on public.form_documents
  for each row execute function public.cert_auto_to_file();

-- تسجيل الشهادات الصادرة سابقًا (قبل تفعيل المحفّز) مرة واحدة
insert into public.perf_evidence (teacher_user_id, academic_year, item_key, source, title,
                                  form_document_id, form_docs, event_date)
select d.recipient_user_id,
       coalesce(nullif((select value from public.settings where key = 'active_year'), ''), to_char(now(), 'YYYY')),
       m.item_key, 'form', d.title || ' · ' || d.serial, d.id, array[d.id], d.created_at::date
from public.form_documents d
join public.form_templates t on t.id = d.template_id
join public.cert_auto_evidence m on m.template_key = t.key and m.is_active
join public.perf_items it on it.key = m.item_key and it.is_record
where d.recipient_user_id is not null
  and d.status in ('issued', 'approved')
  and not exists (select 1 from public.perf_evidence pe
                   where pe.teacher_user_id = d.recipient_user_id
                     and pe.item_key = m.item_key and d.id = any(pe.form_docs));

-- تأكيد: كم شهادة حضور احتُسبت الآن
select count(*) as شهادات_حضور_محتسبة
from public.perf_evidence where item_key = 'e02_02' and source = 'form';
-- نهاية الجزء 1
