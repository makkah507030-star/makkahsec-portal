-- =====================================================================
-- النماذج والشهادات: ما يُصدره الموظف لنفسه لا يصدر إلا باعتماد المدير.
--
-- • عند الإدراج: إن كان المستفيد هو المُصدِر (بحسابه أو باسمه) يُحوَّل
--   المستند تلقائيًا إلى «بانتظار الاعتماد» مهما أُرسل من الواجهة.
-- • عند التعديل: لا يستطيع المُصدِر نقل مستنده الذي باسمه إلى «صادر»
--   أو «معتمد» بنفسه؛ ذلك لمدير المدرسة وحده.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

create or replace function public.fd_is_self_issued(p_doc public.form_documents)
returns boolean language sql stable security definer set search_path = public as $$
  -- coalesce: المستفيد بلا حساب (null) يعني «ليس هو»، لا «غير معروف»
  select coalesce(p_doc.created_by is not null and (
    p_doc.recipient_user_id = p_doc.created_by
    or exists (
      select 1 from public.users u
      where u.id = p_doc.created_by
        and nullif(regexp_replace(trim(u.full_name), '\s+', ' ', 'g'), '') =
            regexp_replace(trim(coalesce(p_doc.recipient, '')), '\s+', ' ', 'g')
    )
  ), false);
$$;

create or replace function public.fd_guard_self_issue()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.fd_is_self_issued(new) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('issued', 'approved') then
      new.status := 'pending';
      new.approved_by := null;
      new.approved_at := null;
    end if;
    return new;
  end if;

  -- التعديل: الإصدار أو الاعتماد لمدير المدرسة فقط
  if new.status in ('issued', 'approved')
     and old.status is distinct from new.status
     and not exists (
       select 1 from public.admin_roles ar
       where ar.user_id = auth.uid() and ar.role_type = 'principal'
     ) then
    raise exception 'المستند باسم مُصدِره، فلا يُعتمد إلا من مدير المدرسة';
  end if;

  return new;
end;
$$;

drop trigger if exists fd_guard_self_issue on public.form_documents;
create trigger fd_guard_self_issue
  before insert or update on public.form_documents
  for each row execute function public.fd_guard_self_issue();

-- ---------------------------------------------------------------------
-- للمراجعة: المستندات التي أصدرها أصحابها لأنفسهم قبل هذا التعديل
-- (شغّل هذا الاستعلام وحده لرؤيتها)
--
-- select d.serial, d.title, d.recipient, u.full_name as issued_by,
--        d.status, d.created_at
-- from public.form_documents d
-- join public.users u on u.id = d.created_by
-- where public.fd_is_self_issued(d)
-- order by d.created_at desc;
-- ---------------------------------------------------------------------
