-- فحص جوال ولي الأمر في كشف الفريق الكشفي (قراءة فقط، لا يغيّر شيئًا).
-- يبيّن أين المشكلة: دالة scout_roster غير منفّذة؟ أم الأعضاء بلا ولي أمر مربوط؟

-- 1) هل دالة scout_roster موجودة؟ (إن كان العدد 0 فشغّل supabase/scouts_3.sql)
select count(*) as دالة_scout_roster_موجودة
from pg_proc where proname = 'scout_roster';

-- 2) لكل عضو في الفريق: هل له ولي أمر مربوط، وهل لولي الأمر جوال؟
select s.full_name as الطالب,
       (exists (select 1 from public.guardian_student gs where gs.student_id = m.student_id)) as له_ولي_أمر_مربوط,
       (select g.mobile from public.guardian_student gs
          join public.guardians g on g.id = gs.guardian_id
         where gs.student_id = m.student_id and coalesce(g.mobile,'') <> ''
         order by g.is_active desc limit 1) as جوال_ولي_الأمر
from public.scout_members m
join public.students s on s.id = m.student_id
order by s.full_name;

-- 3) ملخص: كم عضوًا بلا ولي أمر مربوط، وكم بلا جوال لولي الأمر
select count(*) as إجمالي_الأعضاء,
       count(*) filter (where not exists
         (select 1 from public.guardian_student gs where gs.student_id = m.student_id)) as بلا_ولي_أمر_مربوط,
       count(*) filter (where not exists
         (select 1 from public.guardian_student gs
            join public.guardians g on g.id = gs.guardian_id
           where gs.student_id = m.student_id and coalesce(g.mobile,'') <> '')) as بلا_جوال_لولي_الأمر
from public.scout_members m;
-- نهاية الجزء 1
