-- =====================================================================
-- إصلاحات أمنية — الجزء 1 من 1 (المراجعة الأمنية، الدوال المتاحة لغير المسجّل).
-- • الدالة تُمنح افتراضيًا للجميع (public) ولـ anon مباشرة، فلا يكفي سحبها من أحدهما.
--   يُسحب الإذن من الاثنين لكل دالة SECURITY DEFINER، ويُمنح للمسجّلين ومفتاح الخادم، إلا:
--   دوال الصفحات العامة (ملف المعلم الرقمي، ونموذج الدعم)، والدوال المساعدة التي
--   تعيد نعم/لا أو هوية المستدعي وتعتمد عليها سياسات الأمان.
-- • notify_ticket_support: كان الزائر يرسل للدعم الفني إشعارًا بعنوان ونص ورابط
--   يختارها؛ صار يُبنى من التذكرة نفسها، لتذكرة حديثة (10 دقائق)، ومرة واحدة.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.notify_ticket_support(p_feedback_id uuid, p_title text, p_body text, p_link text)
returns void language plpgsql security definer set search_path = public as $$
declare v_ids uuid[]; f record; v_link text;
begin
  select id, message into f from feedback
   where id = p_feedback_id and created_at > now() - interval '10 minutes';
  if f.id is null then return; end if;
  v_link := '/ticket/' || f.id;
  if exists (select 1 from notifications where link = v_link) then return; end if;   -- مرة واحدة
  select array_agg(distinct ar.user_id) into v_ids from admin_roles ar
   where ar.role_type = 'tech_support'
      or ar.role_type in (select role_type from role_permissions where permission = 'feedback');
  if v_ids is null then return; end if;
  -- p_title وp_body وp_link من الزائر تُهمَل (يبقى التوقيع كما هو لصفحة الدعم)
  perform send_notification(p_title => 'طلب دعم جديد', p_body => left(f.message, 140), p_kind => 'alert',
    p_link => v_link, p_roles => null, p_user_ids => v_ids, p_grade => null, p_class_no => null, p_is_auto => true);
end $$;

do $do$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef
       and p.prorettype not in ('trigger'::regtype, 'boolean'::regtype)
       and has_function_privilege('anon', p.oid, 'EXECUTE')
       and p.proname not in (
         -- الصفحات العامة
         'dfile_public', 'dfile_visit_start', 'dfile_visit_note', 'dfile_visit_ping',
         'submit_public_feedback', 'notify_ticket_support',
         -- هوية المستدعي والعام النشط (تعتمد عليها السياسات)
         'current_user_role', 'current_guardian_id', 'current_student_id', 'current_teacher_id',
         'active_term', 'active_year')
  loop
    -- الإذن الافتراضي للجميع (public) يشمل anon، فيُسحب من الاثنين ثم يُمنح لمن يحتاجه
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $do$;

-- التحقق: ما بقي متاحًا لغير المسجّل (يُفترض قائمة الاستثناءات والدوال المساعدة نعم/لا)
select p.proname as "الدالة المتاحة لغير المسجّل", pg_get_function_result(p.oid) as "تعيد"
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and has_function_privilege('anon', p.oid, 'EXECUTE') and p.prorettype <> 'trigger'::regtype
 order by 2, 1;
-- نهاية الجزء 1
