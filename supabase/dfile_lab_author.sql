-- =====================================================================
-- ملف المعلم الرقمي: خيار «أنا من أعدّ دروس المعمل الرقمي» لمحضر معمل الحاسب الآلي وحده.
-- • يُلغى الخيار عند من اختاره من غير المحضر، فتختفي مكتبة الدروس من ملفه الرقمي.
-- • ولا يُحفظ بعدها إلا لمن له دور «محضر معمل الحاسب الآلي». تكرار التنفيذ آمن.
-- =====================================================================
update public.teacher_dfiles d set lab_author = false
 where lab_author and not exists (select 1 from public.admin_roles r
   where r.user_id = d.teacher_user_id and r.role_type::text = 'computer_lab');

create or replace function public.teacher_dfiles_lab_author() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lab_author and not exists (select 1 from admin_roles r
      where r.user_id = new.teacher_user_id and r.role_type::text = 'computer_lab') then
    new.lab_author := false;
  end if;
  return new;
end $$;
drop trigger if exists teacher_dfiles_lab_author on public.teacher_dfiles;
create trigger teacher_dfiles_lab_author before insert or update of lab_author on public.teacher_dfiles
  for each row execute function public.teacher_dfiles_lab_author();

-- نهاية الجزء 1
