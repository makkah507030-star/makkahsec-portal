-- ملف المعلم الرقمي (الجزء 5): الرابط العام للزائر وسجل الزوار.
-- • dfile_public: يفتحه أي زائر بكود الملف دون دخول، ولا يعرض الملف الموقوف.
-- • dfile_visits: من فتح الملف ومتى وكم ثانية وطريقة الفتح، يراه المعلم صاحبه فقط
--   (والمدير والدعم الفني للمتابعة). الاسم والجهة اختياريان.
-- يُنفَّذ بعد الأجزاء 1 إلى 4. تكرار التنفيذ آمن.

create or replace function public.dfile_public(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f public.teacher_dfiles;
begin
  select d.* into f from public.teacher_dfiles d join public.users u on u.id = d.teacher_user_id
   where d.code = upper(trim(p_code)) and d.disabled_at is null and u.is_active;
  if not found then return jsonb_build_object('status', 'off'); end if;
  return jsonb_build_object('status', 'ok',
    'settings', jsonb_build_object('code', f.code, 'color', f.color, 'hidden', f.hidden, 'sentences', f.sentences,
      'appoint_year', f.appoint_year, 'perf_rating', f.perf_rating, 'perf_year', f.perf_year, 'rank', f.rank,
      'other_wins', f.other_wins, 'madrasati', f.madrasati, 'activities', f.activities),
    'data', public.dfile_data_core(f.teacher_user_id));
end; $$;

revoke execute on function public.dfile_public(text) from public;
grant  execute on function public.dfile_public(text) to anon, authenticated;

create table if not exists public.dfile_visits (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null references public.users(id) on delete cascade,
  visitor_name text,
  visitor_org text,
  via text not null default 'link' check (via in ('qr', 'link')),
  started_at timestamptz not null default now(),
  seconds integer not null default 0
);
create index if not exists dfile_visits_teacher_idx on public.dfile_visits (teacher_user_id, started_at desc);

alter table public.dfile_visits enable row level security;
drop policy if exists dfile_visits_read on public.dfile_visits;
create policy dfile_visits_read on public.dfile_visits for select to authenticated
  using (teacher_user_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support']));

-- بدء الزيارة: لا تُسجَّل زيارة المعلم لملفه
create or replace function public.dfile_visit_start(p_code text, p_name text, p_org text, p_via text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare uid uuid; vid uuid;
begin
  select teacher_user_id into uid from public.teacher_dfiles
   where code = upper(trim(p_code)) and disabled_at is null;
  if uid is null or uid = auth.uid() then return null; end if;
  insert into public.dfile_visits (teacher_user_id, visitor_name, visitor_org, via)
  values (uid, nullif(left(trim(coalesce(p_name, '')), 80), ''), nullif(left(trim(coalesce(p_org, '')), 80), ''),
          case when p_via = 'qr' then 'qr' else 'link' end)
  returning id into vid;
  return vid;
end; $$;

-- مدة الزيارة: تزيد فقط، وحدها ساعتان، وخلال ثلاث ساعات من بدئها
create or replace function public.dfile_visit_ping(p_id uuid, p_seconds integer)
returns void language sql volatile security definer set search_path = public as $$
  update public.dfile_visits
     set seconds = greatest(seconds, least(coalesce(p_seconds, 0), 7200))
   where id = p_id and started_at > now() - interval '3 hours';
$$;

revoke execute on function public.dfile_visit_start(text, text, text, text) from public;
revoke execute on function public.dfile_visit_ping(uuid, integer) from public;
grant  execute on function public.dfile_visit_start(text, text, text, text) to anon, authenticated;
grant  execute on function public.dfile_visit_ping(uuid, integer) to anon, authenticated;
-- نهاية الجزء 5
