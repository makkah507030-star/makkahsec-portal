-- =====================================================================
-- التطوير المهني (الجزء 6 من 7): الزيارات التبادلية بين معلمي القسم.
--
-- • exchange_visits: يصدرها المعلم الزائر لزميل من قسمه بمراحل: مسودة ←
--   بانتظار توقيع المستضيف ← بانتظار الاعتماد ← معتمدة (أو مُعادة).
--   ratings: { مفتاح المؤشر: met | partial | not }.
-- • يطّلع عليها الزائر والمستضيف ورئيس القسم، والمدير ووكيل الشؤون
--   التعليمية والدعم الفني.
-- يُنفَّذ بعد الأجزاء 1–5. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.exchange_visits (
  id uuid primary key default gen_random_uuid(),
  serial text,
  department_id uuid not null references public.departments(id),
  visitor_user_id uuid not null default auth.uid(),
  visitor_name text,
  host_user_id uuid not null,
  host_name text,
  academic_year text,
  data jsonb not null default '{}'::jsonb,       -- التاريخ والفصل والمادة والحصة والدرس
  ratings jsonb not null default '{}'::jsonb,
  strengths text,
  recs text,
  host_comment text,
  host_signed_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'hosting', 'pending', 'approved', 'returned')),
  sent_at timestamptz,
  decided_by uuid, decided_name text, decided_at timestamptz, decision_note text,
  principal_note text, principal_name text, principal_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (host_user_id <> visitor_user_id)
);
create index if not exists exchange_visits_dept_idx on public.exchange_visits (department_id, created_at desc);

alter table public.exchange_visits enable row level security;

-- هل المستخدم (أو مستخدم آخر) عضو في القسم
create or replace function public.in_department(p_dept uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from department_members m join teachers t on t.id = m.teacher_id
                  where m.department_id = p_dept and t.user_id = p_user);
$$;
grant execute on function public.in_department(uuid, uuid) to authenticated;

drop policy if exists xv_read on public.exchange_visits;
create policy xv_read on public.exchange_visits for select to authenticated
  using (visitor_user_id = auth.uid() or host_user_id = auth.uid()
         or public.is_dept_head(department_id)
         or public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']));

drop policy if exists xv_insert on public.exchange_visits;
create policy xv_insert on public.exchange_visits for insert to authenticated
  with check (visitor_user_id = auth.uid() and status = 'draft'
              and public.in_department(department_id, auth.uid())
              and public.in_department(department_id, host_user_id));

-- الزائر يعدّل قبل توقيع المستضيف، والدعم الفني لمعالجة الأخطاء
drop policy if exists xv_update on public.exchange_visits;
create policy xv_update on public.exchange_visits for update to authenticated
  using ((visitor_user_id = auth.uid() and status in ('draft', 'hosting', 'returned'))
         or public.has_admin_role(array['tech_support']))
  with check ((visitor_user_id = auth.uid() and status in ('draft', 'hosting', 'returned')
               and public.in_department(department_id, host_user_id))
              or public.has_admin_role(array['tech_support']));

drop policy if exists xv_delete on public.exchange_visits;
create policy xv_delete on public.exchange_visits for delete to authenticated
  using ((visitor_user_id = auth.uid() and status = 'draft') or public.has_admin_role(array['tech_support']));

-- الرقم: ZV-العام-التسلسل
create or replace function public.xv_serial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.serial := 'ZV-' || coalesce(new.academic_year, '') || '-' ||
    lpad((select count(*) + 1 from exchange_visits where academic_year is not distinct from new.academic_year)::text, 4, '0');
  return new;
end;
$$;
drop trigger if exists xv_serial on public.exchange_visits;
create trigger xv_serial before insert on public.exchange_visits for each row execute function public.xv_serial();

-- شواهد الزيارات في سجل التطوير المهني
alter table public.perf_evidence add column if not exists xvisit_id uuid
  references public.exchange_visits(id) on delete cascade;
alter table public.perf_evidence drop constraint if exists perf_evidence_source_check;
alter table public.perf_evidence add constraint perf_evidence_source_check
  check (source in ('upload', 'form', 'plc', 'xvisit'));
-- نهاية الجزء 6
