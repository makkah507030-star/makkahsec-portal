-- ملف المعلم الرقمي (الجزء 6): رأي الإدارة.
-- • يكتبه مدير المدرسة ووكيل الشؤون التعليمية اختياريًا، رأيًا واحدًا لكلٍّ منهما لكل معلم فعّل ملفه.
-- • لا يظهر للزائر إلا إذا اختار المعلم «إظهار»، ولا يعدّل المعلم نصه.
--   إذا عدّله كاتبه عاد «بانتظار موافقة المعلم». لا إشعار للمعلم: الرأي ينتظر في لوحته.
-- الكتابة والقرار عبر الدوال فقط. يُنفَّذ بعد الأجزاء 1 إلى 5. تكرار التنفيذ آمن.

create table if not exists public.dfile_opinions (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references public.users(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete cascade,
  author_role text not null check (author_role in ('principal', 'deputy_academic')),
  author_name text,
  body text not null check (length(body) between 1 and 1200),
  written_at timestamptz not null default now(),
  decision text not null default 'pending' check (decision in ('pending', 'shown', 'hidden')),
  unique (teacher_user_id, author_role)
);

alter table public.dfile_opinions enable row level security;
drop policy if exists dfile_opinions_read on public.dfile_opinions;
create policy dfile_opinions_read on public.dfile_opinions for select to authenticated
  using (teacher_user_id = auth.uid() or author_user_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support']));

-- المعلمون الذين فعّلوا ملفاتهم، ورأي الكاتب الحالي لكلٍّ منهم
create or replace function public.dfile_opinion_list()
returns table (teacher_user_id uuid, name text, body text, decision text, written_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.teacher_user_id, u.full_name, o.body, o.decision, o.written_at
    from public.teacher_dfiles f join public.users u on u.id = f.teacher_user_id
    left join public.dfile_opinions o on o.teacher_user_id = f.teacher_user_id
         and o.author_role = case when public.has_admin_role(array['principal']) then 'principal' else 'deputy_academic' end
   where f.disabled_at is null and public.has_admin_role(array['principal', 'deputy_academic'])
   order by u.full_name;
$$;

-- كتابة الرأي أو تعديله (نص فارغ = حذف). المدير يكتب بصفته مديرًا وإن كان له دور آخر
create or replace function public.dfile_opinion_write(p_teacher uuid, p_body text)
returns void language plpgsql volatile security definer set search_path = public as $$
declare r text; b text := nullif(trim(coalesce(p_body, '')), '');
begin
  r := case when public.has_admin_role(array['principal']) then 'principal'
            when public.has_admin_role(array['deputy_academic']) then 'deputy_academic' end;
  if r is null then raise exception 'غير مصرّح'; end if;
  if not exists (select 1 from public.teacher_dfiles where teacher_user_id = p_teacher and disabled_at is null) then
    raise exception 'المعلم لم يفعّل ملفه';
  end if;
  if b is null then
    delete from public.dfile_opinions where teacher_user_id = p_teacher and author_role = r; return;
  end if;
  insert into public.dfile_opinions (teacher_user_id, author_user_id, author_role, author_name, body)
  values (p_teacher, auth.uid(), r, (select full_name from public.users where id = auth.uid()), left(b, 1200))
  on conflict (teacher_user_id, author_role) do update
    set body = excluded.body, author_user_id = excluded.author_user_id, author_name = excluded.author_name,
        written_at = now(),
        decision = case when public.dfile_opinions.body = excluded.body then public.dfile_opinions.decision else 'pending' end;
end; $$;

-- قرار المعلم: إظهار أو إخفاء
create or replace function public.dfile_opinion_decide(p_id uuid, p_show boolean)
returns void language sql volatile security definer set search_path = public as $$
  update public.dfile_opinions set decision = case when p_show then 'shown' else 'hidden' end
   where id = p_id and teacher_user_id = auth.uid();
$$;

revoke execute on function public.dfile_opinion_list() from public, anon;
revoke execute on function public.dfile_opinion_write(uuid, text) from public, anon;
revoke execute on function public.dfile_opinion_decide(uuid, boolean) from public, anon;
grant  execute on function public.dfile_opinion_list() to authenticated;
grant  execute on function public.dfile_opinion_write(uuid, text) to authenticated;
grant  execute on function public.dfile_opinion_decide(uuid, boolean) to authenticated;
-- نهاية الجزء 6
