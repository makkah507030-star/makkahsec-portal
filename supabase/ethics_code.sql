-- =====================================================================
-- ميثاق أخلاقيات المهنة (مدونة قواعد السلوك الوظيفي وأخلاقيات الوظيفة العامة)
-- • المعلم يطّلع على المدونة في البوابة ويقرّ باطّلاعه مرة واحدة.
-- • التقرير (من اطّلع ومن لم يطّلع): المدير ووكيل الشؤون التعليمية والدعم الفني.
-- • doc_acks عامّ لأي وثيقة يلزم الإقرار بها لاحقًا (doc_key يميّزها).
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.doc_acks (
  doc_key   text not null,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text,
  acked_at  timestamptz not null default now(),
  primary key (doc_key, user_id)
);

-- صاحب الإقرار ووقته واسمه من الخادم لا من المتصفح
create or replace function public.doc_acks_stamp()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.acked_at := now();
  select coalesce(u.full_name, u.username) into new.full_name from public.users u where u.id = auth.uid();
  return new;
end $$;
drop trigger if exists doc_acks_stamp on public.doc_acks;
create trigger doc_acks_stamp before insert on public.doc_acks
  for each row execute function public.doc_acks_stamp();

-- من يطّلع على تقرير الإقرارات
create or replace function public.doc_acks_viewer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_roles r where r.user_id = auth.uid()
                 and r.role_type in ('principal', 'deputy_academic', 'tech_support'));
$$;
revoke execute on function public.doc_acks_viewer() from public, anon;
grant execute on function public.doc_acks_viewer() to authenticated;

alter table public.doc_acks enable row level security;
drop policy if exists doc_acks_read on public.doc_acks;
create policy doc_acks_read on public.doc_acks for select to authenticated
  using (user_id = auth.uid() or public.doc_acks_viewer());
drop policy if exists doc_acks_insert on public.doc_acks;
create policy doc_acks_insert on public.doc_acks for insert to authenticated
  with check (auth.uid() is not null);
-- الإقرار لا يُعدَّل ولا يُحذف من البوابة

-- المعلمون وجوالاتهم للتقرير والتذكير (الجوال محجوب عن القراءة المباشرة)
create or replace function public.doc_acks_teachers()
returns table (user_id uuid, full_name text, mobile text)
language sql stable security definer set search_path = public as $$
  select t.user_id, t.full_name, t.mobile from public.teachers t
  where public.doc_acks_viewer() and t.user_id is not null and coalesce(t.is_active, true);
$$;
revoke execute on function public.doc_acks_teachers() from public, anon;
grant execute on function public.doc_acks_teachers() to authenticated;
-- نهاية الملف
