-- فحص (قراءة فقط): نماذج التطوير المهني المعتمدة هذا العام وعلامات تستحق المراجعة،
-- لمراجعتها يدويًا قبل «إلغاء الاعتماد» من صفحة النموذج. لا يغيّر شيئًا.
select r.serial as "الرقم", r.owner_name as "صاحبه", r.kind as "النوع", r.data->>'title' as "العنوان",
       r.data->>'date' as "تاريخ التنفيذ", r.created_at::date as "أُنشئ", r.decided_at::date as "اعتُمد",
       jsonb_array_length(r.files) as "المرفقات", jsonb_array_length(r.attendees) as "الحاضرون",
       concat_ws('، ',
         case when jsonb_array_length(r.files) = 0 then 'بلا مرفق' end,
         case when r.kind in ('training', 'research', 'field_visit') then 'نشاط خارجي لا يُعتمد في المدرسة' end,
         case when r.kind in ('workshop', 'applied', 'lesson_study') and r.plan_approved_at is null then 'بلا خطة قبل التنفيذ' end,
         case when (r.data->>'date') is not null and r.created_at::date - (r.data->>'date')::date > 30 then 'وُثّق بعد التنفيذ بأكثر من شهر' end,
         case when (r.data->>'date')::date < (select min(start_date) from public.academic_calendar where academic_year = r.academic_year) then 'تاريخه قبل بداية العام الدراسي' end,
         case when (r.data->>'date')::date > r.created_at::date then 'وُثّق قبل تاريخ تنفيذه' end,
         case when exists (select 1 from public.pd_reports x where x.id <> r.id and x.owner_user_id = r.owner_user_id and x.kind = r.kind
                  and x.status = 'approved' and x.data->>'date' = r.data->>'date' and trim(x.data->>'title') = trim(r.data->>'title')) then 'مكرر' end,
         case when (select count(*) from public.pd_reports x where x.owner_user_id = r.owner_user_id and x.status = 'approved'
                     and x.decided_at::date = r.decided_at::date) >= 4 then 'أربعة نماذج أو أكثر اعتُمدت له في يوم واحد' end
       ) as "علامات للمراجعة"
  from public.pd_reports r
 where r.status = 'approved' and r.academic_year = (select value from public.settings where key = 'active_year')
 order by r.owner_name, r.decided_at;
-- نهاية الجزء 1
