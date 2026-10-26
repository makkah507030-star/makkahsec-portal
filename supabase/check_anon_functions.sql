-- =====================================================================
-- قراءة فقط: الدوال مرتفعة الصلاحية (SECURITY DEFINER) التي يستطيع غير المسجّل استدعاءها،
-- مصنّفة للمراجعة. «بلا فحص» = لا يرد في جسمها auth.uid ولا فحص دور ولا رفض.
-- المشتبه بها أولًا: بلا فحص، ثم ما يعدّل البيانات (volatile)، ثم ما يعيد قوائم.
-- يُنفَّذ في Supabase ← SQL Editor، وتُرسل النتيجة كاملة.
-- =====================================================================
select p.proname as "الدالة",
       pg_get_function_identity_arguments(p.oid) as "المدخلات",
       case when p.prosrc ~* '(auth\.uid|has_admin_role|has_any_admin_role|is_admin|is_tech_support|current_teacher_id|raise\s+exception|_can_|_can\(|is_staff|is_guardian_of)'
            then 'فيها فحص' else 'بلا فحص' end as "الهوية",
       case p.provolatile when 'v' then 'تعدّل' else 'تقرأ' end as "النوع",
       case when p.proretset then 'قائمة' else 'قيمة' end as "تعيد"
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.prosecdef
   and has_function_privilege('anon', p.oid, 'EXECUTE')
   and p.prorettype <> 'trigger'::regtype
 order by 3 desc, 4 desc, 5, 1;
-- نهاية الجزء 1
