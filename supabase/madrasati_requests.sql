-- =====================================================================
-- دعم منصة مدرستي داخل البوابة (بدل الموقع الملحق): طلبات الطالب البسيطة من «مركز الدعم والمساندة»:
-- كلمة مرور جديدة (المنصة ترسلها على الجوال المسجّل فيها، وهو جوال ولي الأمر من نور كما في البوابة؛
-- يُعرض للطالب، فإن لم يعمل كتب رقمًا جديدًا يُسجَّل في المنصة وحدها)، وتغيير الفصل، ومشكلة أخرى.
-- يعالجها الدعم الفني (ويطّلع المدير)، ويصل الطالب إشعار بالرد. يُنفَّذ مرة، وتكرار تنفيذه آمن.
-- =====================================================================
create table if not exists public.madrasati_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  student_name text, national_id text, class_label text,
  kind text not null check (kind in ('password', 'class', 'other')),
  mobile text check (mobile is null or mobile ~ '^05[0-9]{8}$'),
  current_mobile text,   -- جوال ولي الأمر في البوابة (نور) يوم الطلب، ولا يتغير في البوابة
  target_class text, details text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'done', 'rejected')),
  reply text, handled_by uuid, handled_by_name text, handled_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.madrasati_requests add column if not exists current_mobile text;
-- طلب مفتوح واحد من كل نوع للطالب
create unique index if not exists madrasati_requests_open on public.madrasati_requests (user_id, kind)
  where status in ('new', 'in_progress');

create or replace function public.madrasati_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_roles where user_id = auth.uid() and role_type in ('tech_support', 'principal'));
$$;

-- جوال ولي الأمر الأساسي للطالب الحالي: هو المسجّل في المنصة من نور
create or replace function public.madrasati_my_mobile() returns text
language sql stable security definer set search_path = public as $$
  select g.mobile from public.students s
    join public.guardian_student gs on gs.student_id = s.id join public.guardians g on g.id = gs.guardian_id
   where s.user_id = auth.uid() and coalesce(g.mobile, '') <> ''
   order by gs.is_primary desc, g.is_active desc limit 1;
$$;
revoke execute on function public.madrasati_my_mobile() from public, anon;
grant execute on function public.madrasati_my_mobile() to authenticated;

-- بيانات الطالب من سجله في الخادم لا مما يرسله، ثم إشعار الدعم الفني
create or replace function public.madrasati_request_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare v record; ids uuid[];
begin
  if not exists (select 1 from public.users where id = auth.uid() and role::text = 'student') then
    raise exception 'الطلب من حساب الطالب نفسه';
  end if;
  select s.id, s.full_name, s.national_id, a.grade, a.class_no into v
    from public.students s left join public.v_active_students a on a.student_id = s.id
   where s.user_id = auth.uid() limit 1;
  new.user_id := auth.uid(); new.student_id := v.id; new.student_name := v.full_name;
  new.national_id := v.national_id; new.current_mobile := public.madrasati_my_mobile(); new.status := 'new'; new.reply := null; new.handled_by := null;
  new.class_label := case v.grade when 1 then 'الأول الثانوي' when 2 then 'الثاني الثانوي' when 3 then 'الثالث الثانوي' end
                     || coalesce(' · ' || v.class_no, '');
  -- كلمة المرور على الرقم الجديد إن كُتب، وإلا فعلى المسجّل
  if new.kind = 'password' and coalesce(new.mobile, new.current_mobile) is null then raise exception 'اكتب رقم الجوال لاستلام كلمة المرور'; end if;
  if new.kind = 'class' and coalesce(trim(new.target_class), '') = '' then raise exception 'اختر الفصل الصحيح'; end if;
  if new.kind = 'other' and coalesce(trim(new.details), '') = '' then raise exception 'اكتب وصف المشكلة'; end if;
  ids := array(select user_id from public.admin_roles where role_type = 'tech_support');
  if cardinality(ids) > 0 then
    perform public.send_notification('طلب جديد لمنصة مدرستي',
      coalesce(v.full_name, 'طالب') || ': ' || case new.kind when 'password' then 'كلمة مرور جديدة'
        when 'class' then 'تغيير الفصل في المنصة' else 'مشكلة أخرى' end,
      'general', '/madrasati-requests', null, ids, null, null, true);
  end if;
  return new;
end;
$$;
drop trigger if exists madrasati_request_fill on public.madrasati_requests;
create trigger madrasati_request_fill before insert on public.madrasati_requests
  for each row execute function public.madrasati_request_fill();

alter table public.madrasati_requests enable row level security;
drop policy if exists mr_read on public.madrasati_requests;
create policy mr_read on public.madrasati_requests for select to authenticated
  using (user_id = auth.uid() or public.madrasati_staff());
drop policy if exists mr_insert on public.madrasati_requests;
create policy mr_insert on public.madrasati_requests for insert to authenticated with check (user_id = auth.uid());
drop policy if exists mr_update on public.madrasati_requests;
create policy mr_update on public.madrasati_requests for update to authenticated
  using (public.madrasati_staff()) with check (public.madrasati_staff());
-- الطالب يلغي طلبه الجديد قبل معالجته
drop policy if exists mr_delete on public.madrasati_requests;
create policy mr_delete on public.madrasati_requests for delete to authenticated
  using ((user_id = auth.uid() and status = 'new') or public.madrasati_staff());

-- فصول السنة الحالية لقائمة «الفصل الصحيح»
create or replace function public.madrasati_classes() returns table (grade int, class_no int)
language sql stable security definer set search_path = public as $$
  select distinct c.grade, c.class_no from public.classes c
   where c.is_active and c.academic_year = public.active_year() order by 1, 2;
$$;
revoke execute on function public.madrasati_classes() from public, anon;
grant execute on function public.madrasati_classes() to authenticated;
revoke execute on function public.madrasati_staff() from public, anon;
grant execute on function public.madrasati_staff() to authenticated;
-- نهاية الجزء 1
