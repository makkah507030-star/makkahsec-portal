-- ملف المعلم الرقمي (الجزء 1 من 3): جدول الإعدادات وصلاحياته.
-- • صف لكل معلم فعّل ملفه، والكود ثابت طوال العام (رابط الزائر في المرحلة الثانية).
-- • المعلم يكتب إعداداته، ولا يستطيع الإيقاف: الإيقاف للدعم الفني وحده.
-- تكرار التنفيذ آمن.

create table if not exists public.teacher_dfiles (
  teacher_user_id uuid primary key references public.users(id) on delete cascade,
  code text not null unique,
  color text not null default 'science',
  hidden text[] not null default '{}',          -- الأقسام المخفية عن الزائر
  sentences text[],                             -- جمل «قراءة في 30 ثانية» المختارة
  appoint_year integer,                         -- سنة التعيين الهجرية
  perf_rating numeric(3,2) check (perf_rating between 1 and 5),
  perf_year integer,                            -- عام التقييم الهجري
  rank text check (rank in ('معلم ممارس', 'معلم متقدم', 'معلم خبير')),
  other_wins jsonb not null default '[]'::jsonb, -- [{ t, d }]
  photo_path text,
  enabled_at timestamptz not null default now(),
  disabled_at timestamptz,
  disabled_by uuid,
  disabled_reason text,
  updated_at timestamptz not null default now()
);

-- كود قصير بلا أحرف ملتبسة (O/0، I/1)
create or replace function public.dfile_new_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'MS-';
    for i in 1..4 loop c := c || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
    exit when not exists (select 1 from public.teacher_dfiles where code = c);
  end loop;
  return c;
end; $$;

-- المعلم لا يغيّر الكود ولا الإيقاف، والدعم الفني وحده يوقف ويعيد
create or replace function public.teacher_dfiles_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.code := public.dfile_new_code();
    new.disabled_at := null; new.disabled_by := null; new.disabled_reason := null;
  elsif auth.uid() is not null and not public.has_admin_role(array['tech_support']) then  -- محرر SQL بلا مستخدم مسموح
    new.teacher_user_id := old.teacher_user_id; new.code := old.code;
    new.disabled_at := old.disabled_at; new.disabled_by := old.disabled_by;
    new.disabled_reason := old.disabled_reason;
  end if;
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists teacher_dfiles_guard on public.teacher_dfiles;
create trigger teacher_dfiles_guard before insert or update on public.teacher_dfiles
  for each row execute function public.teacher_dfiles_guard();

alter table public.teacher_dfiles enable row level security;

drop policy if exists teacher_dfiles_read on public.teacher_dfiles;
create policy teacher_dfiles_read on public.teacher_dfiles for select to authenticated
  using (teacher_user_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support']));

-- التفعيل: لمن له سجل معلم فقط
drop policy if exists teacher_dfiles_insert on public.teacher_dfiles;
create policy teacher_dfiles_insert on public.teacher_dfiles for insert to authenticated
  with check (teacher_user_id = auth.uid()
              and exists (select 1 from public.teachers t where t.user_id = auth.uid()));

drop policy if exists teacher_dfiles_update on public.teacher_dfiles;
create policy teacher_dfiles_update on public.teacher_dfiles for update to authenticated
  using (teacher_user_id = auth.uid() or public.has_admin_role(array['tech_support']))
  with check (teacher_user_id = auth.uid() or public.has_admin_role(array['tech_support']));

-- صور المعلمين في البطاقة: مجلد لكل معلم باسم معرّفه
insert into storage.buckets (id, name, public) values ('dfile-photos', 'dfile-photos', false)
on conflict (id) do nothing;

drop policy if exists dfile_photos_own on storage.objects;
create policy dfile_photos_own on storage.objects for all to authenticated
  using (bucket_id = 'dfile-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'dfile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- نهاية الجزء 1
