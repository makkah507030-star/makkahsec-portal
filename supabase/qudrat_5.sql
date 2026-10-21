-- =====================================================================
-- مركز التدريب — القدرات: الرد الصوتي من المعلم على سؤال الطالب
-- التسجيل في مخزن خاص qudrat-voice في مجلد باسم السؤال: يرفعه المعلم المسند
-- إليه السؤال أو الإدارة، ويسمعه صاحب السؤال ومن يحق له الرد.
-- يلزم قبله qudrat_3 و qudrat_4. تكرار التنفيذ آمن.
-- =====================================================================

alter table public.qudrat_asks add column if not exists reply_audio text;   -- مسار التسجيل في المخزن
alter table public.qudrat_asks add column if not exists reply_secs int;     -- مدته بالثواني

insert into storage.buckets (id, name, public, file_size_limit)
values ('qudrat-voice', 'qudrat-voice', false, 6291456)
on conflict (id) do nothing;

-- صلاحية السؤال من اسم المجلد (رقم السؤال)، ولا خطأ إن لم يكن الاسم رقمًا صحيحًا
create or replace function public.qudrat_ask_access(p_folder text, p_answer boolean)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare a qudrat_asks;
begin
  select * into a from public.qudrat_asks where id = p_folder::uuid;
  if a.id is null then return false; end if;
  return coalesce(a.teacher_id = current_teacher_id(), false) or coalesce(qudrat_manager(), false)
      or (not p_answer and a.student_user = auth.uid());
exception when others then return false;
end $$;

drop policy if exists "qudrat voice add" on storage.objects;
create policy "qudrat voice add" on storage.objects for insert to authenticated
  with check (bucket_id = 'qudrat-voice' and public.qudrat_ask_access((storage.foldername(name))[1], true));
drop policy if exists "qudrat voice read" on storage.objects;
create policy "qudrat voice read" on storage.objects for select to authenticated
  using (bucket_id = 'qudrat-voice' and public.qudrat_ask_access((storage.foldername(name))[1], false));
drop policy if exists "qudrat voice del" on storage.objects;
create policy "qudrat voice del" on storage.objects for delete to authenticated
  using (bucket_id = 'qudrat-voice' and public.qudrat_ask_access((storage.foldername(name))[1], true));

-- الرد: نص أو تسجيل صوتي أو كلاهما
drop function if exists public.qudrat_reply(uuid, text);
create or replace function public.qudrat_reply(p_id uuid, p_reply text, p_audio text default null, p_secs int default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.qudrat_asks; nid uuid; txt text := nullif(trim(coalesce(p_reply, '')), '');
begin
  select * into a from qudrat_asks where id = p_id;
  if a.id is null then raise exception 'السؤال غير موجود'; end if;
  if not coalesce(a.teacher_id = current_teacher_id() or qudrat_manager(), false) then raise exception 'ليس لك الرد على هذا السؤال'; end if;
  if p_audio is not null and p_audio not like p_id::text || '/%' then raise exception 'مسار التسجيل غير صحيح'; end if;
  if txt is null and p_audio is null then raise exception 'اكتب الرد أو سجّله'; end if;
  update qudrat_asks set reply = coalesce(txt, ''), reply_audio = p_audio, reply_secs = p_secs,
         replied_by = auth.uid(), replied_at = now(), seen = false where id = p_id;
  nid := send_notification('رد معلمك على سؤالك في مركز التدريب',
           case when p_audio is not null then '🎙️ رد صوتي' || coalesce(' · ' || left(txt, 120), '') else left(txt, 140) end,
           'general', '/qudrat', null, array[a.student_user], null, null, true);
  begin perform push_notification(nid); exception when others then null; end;
end $$;
revoke all on function public.qudrat_reply(uuid, text, text, int) from public, anon;
grant execute on function public.qudrat_reply(uuid, text, text, int) to authenticated;
revoke all on function public.qudrat_ask_access(text, boolean) from public, anon;
grant execute on function public.qudrat_ask_access(text, boolean) to authenticated;

-- نهاية الجزء 1
