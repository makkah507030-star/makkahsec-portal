-- =====================================================================
-- قسم التقويم والاعتماد (8): محضر لجنة التميز بالصيغة الرسمية والتوقيع الإلكتروني.
-- • بيانات الاجتماع كاملة: الرقم والوقت والمكان والرئيس والمقرر، والمحاور، وما نوقش،
--   ومتابعة توصيات الاجتماع السابق، والقرارات والتوصيات، والضيوف.
-- • مراحل المحضر: مسودة ← أرسله المشرف للتوقيع ← وقّع الحاضرون ← اعتمده المدير.
-- • يوقّع كل حاضر بنفسه، وتظهر صورة توقيعه من «توقيعي» لأعضاء اللجنة.
-- يُنفَّذ بعد acc_3.sql وpd_signer_signatures.sql. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.acc_meetings
  add column if not exists number text,
  add column if not exists time_from text,
  add column if not exists time_to text,
  add column if not exists place text,
  add column if not exists chair_name text,
  add column if not exists secretary_name text,
  add column if not exists guests jsonb not null default '[]',      -- [{ name, title }]
  add column if not exists followup text,                           -- متابعة توصيات الاجتماع السابق
  add column if not exists discussion text,
  add column if not exists status text not null default 'draft',
  add column if not exists sent_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_name text;
alter table public.acc_meetings drop constraint if exists acc_meetings_status_check;
alter table public.acc_meetings add constraint acc_meetings_status_check
  check (status in ('draft', 'signing', 'approved'));

create table if not exists public.acc_meeting_signs (
  meeting_id uuid not null references public.acc_meetings(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  name text,
  signed_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);
alter table public.acc_meeting_signs enable row level security;

drop policy if exists acc_msign_read on public.acc_meeting_signs;
create policy acc_msign_read on public.acc_meeting_signs for select to authenticated using (public.acc_member());

-- يوقّع الحاضر بنفسه ما دام المحضر مرسلًا للتوقيع
drop policy if exists acc_msign_insert on public.acc_meeting_signs;
create policy acc_msign_insert on public.acc_meeting_signs for insert to authenticated
  with check (user_id = auth.uid() and exists (
    select 1 from public.acc_meetings m where m.id = meeting_id and m.status = 'signing' and auth.uid() = any(m.attendees)));

-- المشرف يمسح التوقيعات حين يعيد المحضر مسودة للتعديل
drop policy if exists acc_msign_delete on public.acc_meeting_signs;
create policy acc_msign_delete on public.acc_meeting_signs for delete to authenticated using (public.acc_coord());
grant select, insert, delete on public.acc_meeting_signs to authenticated;

-- الحاضر غير المشرف يقرأ المحضر أصلًا (acc_member)، ولا يعدّله؛ والاعتماد للمدير من الواجهة
-- قراءة صور توقيع من وقّع على محضر لأعضاء اللجنة
drop policy if exists "read acc minutes signatures" on storage.objects;
create policy "read acc minutes signatures" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-assets'
    and public.acc_member()
    and exists (select 1 from public.acc_meeting_signs g where g.user_id = public.sig_owner(objects.name))
  );
-- نهاية الجزء 1
