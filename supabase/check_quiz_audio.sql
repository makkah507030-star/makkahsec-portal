-- =====================================================================
-- فحص (للقراءة فقط، لا يغيّر شيئًا): لماذا لا يظهر صوت الاستماع للطلاب في الاختبار الإلكتروني؟
-- يُشغَّل في Supabase ← SQL Editor، وتُرسل نتيجته كما هي.
-- =====================================================================

-- 1) هل الدالة التي يفتح بها الطالب الاختبار ترسل له الصوت وعلامة أسئلة الاستماع؟
select position('listening_audio' in prosrc) > 0 as "الدالة ترسل الصوت",
       position('''listening''' in prosrc) > 0 as "الدالة ترسل علامة الاستماع",
       position('image_path' in prosrc) > 0 as "الدالة بنسخة الصور"
from pg_proc where proname = 'get_online_quiz';

-- 2) سياسة سماع الطالب للملف، ودالتها
select exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'quiz audio read') as "سياسة القراءة موجودة",
       to_regprocedure('public.quiz_audio_listener(text)') is not null as "دالة الطالب موجودة",
       (select public from storage.buckets where id = 'quiz-audio') as "المخزن عام؟";

-- 3) آخر اختبارات الإنجليزي الإلكترونية: هل فيها ملف صوت، وهل الملف موجود فعلًا في المخزن،
--    وكم سؤال استماع، وكم طالبًا بدأ ولم يسلّم
select q.title as "الاختبار", q.created_at::date as "أُنشئ", q.mode as "النوع",
       q.listening_audio is not null as "له ملف صوت",
       exists (select 1 from storage.objects o where o.bucket_id = 'quiz-audio' and o.name = q.listening_audio) as "الملف في المخزن",
       (select o.metadata ->> 'mimetype' from storage.objects o where o.bucket_id = 'quiz-audio' and o.name = q.listening_audio) as "نوع الملف",
       (select round((o.metadata ->> 'size')::numeric / 1048576, 1) from storage.objects o where o.bucket_id = 'quiz-audio' and o.name = q.listening_audio) as "الحجم ميجا",
       (select count(*) from quiz_questions x where x.quiz_id = q.id and x.listening) as "أسئلة الاستماع",
       (select count(*) from quiz_assignments a where a.quiz_id = q.id and a.started_at is not null and a.submitted_at is null) as "بدأوا ولم يسلّموا",
       (select count(*) from quiz_assignments a where a.quiz_id = q.id and a.submitted_at is not null) as "سلّموا"
from quizzes q
where q.lang = 'en' or q.listening_audio is not null
order by q.created_at desc
limit 8;

-- نهاية الجزء 1
