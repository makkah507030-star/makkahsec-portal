-- =====================================================================
-- الاختبار الورقي: نوع ثالث من الاختبارات، يُطبع بلا بطاقة تظليل
-- ويُصحَّح يدويًا.
--
--   • quizzes.paper_opts: خيارات الورقة (مضغوط، جدول الدرجات).
--   • quizzes.mode: 'omr' (الاختبار القصير ببطاقة التظليل والإلكتروني — كما كان)
--                   أو 'paper' (الاختبار الورقي).
--   • أنماط أسئلة جديدة للورقي: أكمل الفراغ، رتّب، أجب باختصار، سؤال مقالي.
--   • quiz_save_manual_marks: رصد درجات الطالب فقرةً فقرة، ويُحسب مجموعه في الخادم.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- لا يمسّ الاختبارات السابقة: كلها تبقى 'omr'.
-- =====================================================================

alter table public.quizzes
  add column if not exists mode text not null default 'omr';

-- خيارات الورقة: التنسيق المضغوط، وجدول الدرجات
alter table public.quizzes
  add column if not exists paper_opts jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quizzes_mode_check') then
    alter table public.quizzes
      add constraint quizzes_mode_check check (mode in ('omr', 'paper'));
  end if;
end $$;

-- أنماط الأسئلة: يُزال أي قيد سابق على kind ويُضاف قيد يشمل الأنماط الجديدة
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.quiz_questions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.quiz_questions drop constraint %I', r.conname);
  end loop;

  alter table public.quiz_questions
    add constraint quiz_questions_kind_check
    check (kind in ('mcq', 'truefalse', 'match', 'fill', 'order', 'short', 'essay'));
end $$;

-- رصد يدوي: p_marks = { "<معرّف الفقرة>": درجة, ... }
-- لا يرصد إلا معلم الاختبار، ولا تتجاوز درجة الفقرة درجتها ولا المجموع الدرجة الكلية.
create or replace function public.quiz_save_manual_marks(
  p_quiz    public.quizzes.id%type,
  p_class   public.classes.id%type,
  p_student public.students.id%type,
  p_marks   jsonb,
  p_absent  boolean default false
) returns public.quiz_submissions
language plpgsql security definer set search_path = public as $$
declare
  v_quiz  public.quizzes;
  v_marks jsonb := '{}'::jsonb;
  v_score numeric := 0;
  v_row   public.quiz_submissions;
  q       record;
  m       numeric;
begin
  select * into v_quiz from public.quizzes where id = p_quiz;
  if v_quiz.id is null or v_quiz.teacher_id <> auth.uid() then
    raise exception 'غير مصرّح: الرصد لمعلم الاختبار';
  end if;

  if not coalesce(p_absent, false) then
    for q in select id, marks from public.quiz_questions where quiz_id = p_quiz loop
      if p_marks ? q.id::text and nullif(p_marks->>q.id::text, '') is not null then
        m := greatest(0, least(coalesce(q.marks, 0), (p_marks->>q.id::text)::numeric));
        v_marks := v_marks || jsonb_build_object(q.id::text, m);
        v_score := v_score + m;
      end if;
    end loop;
    v_score := least(v_score, coalesce(v_quiz.total_marks, v_score));
  end if;

  select * into v_row from public.quiz_submissions
  where quiz_id = p_quiz and student_id = p_student
  limit 1;

  if v_row.id is null then
    insert into public.quiz_submissions (quiz_id, class_id, student_id, answers, absent, score, marked_by)
    values (p_quiz, p_class, p_student, jsonb_build_object('manual', v_marks),
            coalesce(p_absent, false), case when p_absent then null else v_score end, auth.uid())
    returning * into v_row;
  else
    update public.quiz_submissions set
      class_id = p_class,
      answers = jsonb_build_object('manual', v_marks),
      absent = coalesce(p_absent, false),
      score = case when p_absent then null else v_score end,
      marked_by = auth.uid()
    where id = v_row.id
    returning * into v_row;
  end if;

  if v_quiz.status = 'ready' then
    update public.quizzes set status = 'marking' where id = p_quiz;
  end if;

  return v_row;
end;
$$;

-- بلا قائمة معاملات: الاسم فريد
revoke execute on function public.quiz_save_manual_marks from public, anon;
grant  execute on function public.quiz_save_manual_marks to authenticated;
