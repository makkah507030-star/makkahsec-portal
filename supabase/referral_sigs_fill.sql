-- تواقيع ملفات الإحالة الفارغة: من اتخذ إجراءه ولم يُحفظ توقيعه في الإحالة
-- (لم يكن رفع توقيعه في «توقيعي» وقتها) يُكمَّل بتوقيعه الحالي. تكرار التنفيذ آمن.

-- 1) الإكمال
update public.student_referrals r set counselor_sig = us.path
  from public.user_signatures us
 where us.user_id = r.counselor_id and r.counselor_sig is null and r.counselor_at is not null;
update public.student_referrals r set deputy_sig = us.path
  from public.user_signatures us
 where us.user_id = r.deputy_id and r.deputy_sig is null and r.deputy_at is not null;
update public.student_referrals r set teacher_sig = us.path
  from public.user_signatures us
 where us.user_id = r.teacher_id and r.teacher_sig is null and r.teacher_id is not null;

-- 2) من ما زال بلا توقيع مرفوع في «توقيعي» (يرفعه ثم يُعاد تشغيل الملف)
select distinct r.counselor_name as الاسم, 'الموجه' as الدور from public.student_referrals r
 where r.counselor_at is not null and r.counselor_sig is null
union
select distinct r.deputy_name, 'الوكيل' from public.student_referrals r
 where r.deputy_at is not null and r.deputy_sig is null;
-- نهاية الجزء 1
