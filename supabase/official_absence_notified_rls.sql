-- تفعيل الحماية (RLS) على جدول official_absence_notified
-- الجدول سجل داخلي يمنع تكرار إشعار الغياب الرسمي، ولا يكتب فيه إلا الدالة notify_official_absence
-- (SECURITY DEFINER، ومالك الجدول يتجاوز RLS). بدون الحماية كان قابلًا للقراءة والتعديل من واجهة البرمجة العامة.
-- لا سياسات = لا وصول للمستخدمين مباشرة، والدالة تعمل كما هي.
alter table public.official_absence_notified enable row level security;
revoke all on public.official_absence_notified from anon;

-- تحقق: يجب أن تكون النتيجة true
select relrowsecurity from pg_class where oid = 'public.official_absence_notified'::regclass;
-- نهاية الملف
