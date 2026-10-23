-- =====================================================================
-- التعاميم (الجزء 3 من 3): توقيع المنسوب في سجل الاطلاع. يُشغَّل بعد الجزء 2. تكرار التنفيذ آمن.
-- • عند «اطّلعت» يُحفظ مع الإقرار مسار توقيع المنسوب من «توقيعي» كما هو وقت الإقرار.
-- • مدير التعاميم يقرأ صور هذه التوقيعات وحدها، فتظهر في كشف الاطلاع المطبوع وفي صفحة التعميم.
-- • ولي الأمر يقرّ إلكترونيًا بلا توقيع، ومن لم يرفع توقيعه يظهر له «أقرّ إلكترونيًا».
-- =====================================================================

alter table public.circular_recipients add column if not exists ack_sig text;

create or replace function public.circular_mark(p_id uuid, p_ack boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update circular_recipients
     set read_at = coalesce(read_at, now()),
         ack_at = case when p_ack then coalesce(ack_at, now()) else ack_at end,
         ack_sig = case when p_ack and ack_sig is null and kind = 'staff'
                        then (select path from user_signatures where user_id = auth.uid()) else ack_sig end
   where circular_id = p_id and user_id = auth.uid();
end $$;
revoke all on function public.circular_mark(uuid, boolean) from public, anon;
grant execute on function public.circular_mark(uuid, boolean) to authenticated;

-- صورة التوقيع نفسها: لمدير التعاميم، وللتوقيعات المحفوظة مع إقرار تعميم فقط
drop policy if exists "read circular ack signatures" on storage.objects;
create policy "read circular ack signatures" on storage.objects for select to authenticated
  using (bucket_id = 'form-assets' and public.circ_manager()
         and exists (select 1 from public.circular_recipients r where r.ack_sig = objects.name));
-- نهاية الجزء 3
