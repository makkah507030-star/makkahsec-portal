-- =====================================================================
--  بنية قاعدة بيانات بوابة مكة الثانوية الرقمية (Supabase — مخطط public
--  وسياسات storage.objects). مرجع للاسترجاع والمراجعة، لا يحوي أي بيانات.
--
--  مُولَّد من ناتج supabase/export_schema.sql (SQL Editor) بتاريخ 2026-09-29.
--  لا تعدّله يدويًا: أعد التصدير بعد أي تعديل في البنية واستبدل هذا الملف.
--
--  الاسترجاع على مشروع Supabase جديد: شغّل الملف كاملًا بالترتيب
--  (مخططا auth وstorage وإضافة pg_net يوفّرها Supabase).
--  الأسرار (مفاتيح، كلمات مرور) لا تُحفظ هنا وتُضبط يدويًا.
-- =====================================================================

set check_function_bodies = off;


-- ---------------------------------------------------------------------
--  0) الأنواع (enum) — 11
-- ---------------------------------------------------------------------

-- admin_role_type
create type public.admin_role_type as enum ('principal', 'deputy', 'counselor', 'clerk', 'activity_leader', 'tech_support', 'deputy_academic', 'deputy_school', 'deputy_students', 'counselor_1', 'counselor_2', 'counselor_3', 'media_portal', 'gifted_program', 'globe_program', 'student_voice', 'makkah_sport', 'safety_security', 'health_counselor', 'science_labs', 'computer_lab', 'clerk_2', 'clerk_3', 'science_labs_2', 'science_labs_3', 'data_registrar');

-- attendance_source
create type public.attendance_source as enum ('device', 'manual');

-- class_att_status
create type public.class_att_status as enum ('present', 'absent', 'late', 'excused');

-- enrollment_status
create type public.enrollment_status as enum ('active', 'transferred', 'withdrawn');

-- excuse_type
create type public.excuse_type as enum ('trip', 'competition', 'exam', 'medical', 'other');

-- identity_type_enum
create type public.identity_type_enum as enum ('national', 'iqama', 'border', 'temporary');

-- import_status
create type public.import_status as enum ('running', 'completed', 'failed');

-- review_status_enum
create type public.review_status_enum as enum ('pending', 'approved', 'rejected');

-- sms_status
create type public.sms_status as enum ('queued', 'sent', 'failed');

-- track_type
create type public.track_type as enum ('common_year', 'general_track');

-- user_role
create type public.user_role as enum ('admin', 'teacher', 'student', 'guardian');


-- ---------------------------------------------------------------------
--  1) الجداول — 73
-- ---------------------------------------------------------------------

-- absence_warnings
create table if not exists public.absence_warnings (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  stage text not null,
  days_count integer not null,
  academic_year text,
  term integer,
  issued_on date not null default CURRENT_DATE,
  source text not null default 'system'::text,
  note text,
  issued_at timestamp with time zone not null default now(),
  issued_by uuid,
  issued_by_name text
);

-- academic_calendar
create table if not exists public.academic_calendar (
  id uuid not null default gen_random_uuid(),
  title text not null,
  kind text not null default 'event'::text,
  start_date date not null,
  end_date date,
  hijri_label text,
  note text,
  academic_year text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  logo text
);

-- admin_missing_notes
create table if not exists public.admin_missing_notes (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  note_date date not null default CURRENT_DATE,
  action text not null,
  detail text,
  created_by uuid,
  created_at timestamp with time zone not null default now()
);

-- admin_roles
create table if not exists public.admin_roles (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  role_type admin_role_type not null
);

-- announcement_banners
create table if not exists public.announcement_banners (
  id uuid not null default gen_random_uuid(),
  title text not null,
  body text,
  color text not null default 'mint'::text,
  target_roles text[],
  starts_at timestamp with time zone not null default now(),
  ends_at timestamp with time zone not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamp with time zone not null default now()
);

-- announcement_dismissals
create table if not exists public.announcement_dismissals (
  banner_id uuid not null,
  user_id uuid not null,
  dismissed_at timestamp with time zone not null default now()
);

-- attendance_reminders
create table if not exists public.attendance_reminders (
  schedule_id uuid not null,
  remind_date date not null,
  teacher_id uuid,
  sent_at timestamp with time zone not null default now()
);

-- behavior_notes
create table if not exists public.behavior_notes (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  teacher_id uuid,
  note text not null,
  note_date date not null default CURRENT_DATE,
  review_status review_status_enum not null default 'pending'::review_status_enum,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  academic_year text not null,
  created_at timestamp with time zone not null default now()
);

-- class_attendance
create table if not exists public.class_attendance (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  schedule_id uuid not null,
  attend_date date not null,
  status class_att_status not null default 'present'::class_att_status,
  recorded_by uuid,
  recorded_at timestamp with time zone not null default now(),
  updated_by uuid,
  updated_at timestamp with time zone,
  academic_year text not null
);

-- classes
create table if not exists public.classes (
  id uuid not null default gen_random_uuid(),
  class_no integer not null,
  grade integer not null,
  track track_type not null,
  academic_year text not null,
  is_active boolean not null default true
);

-- daily_attendance
create table if not exists public.daily_attendance (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  attend_date date not null,
  punch_time timestamp with time zone not null,
  source attendance_source not null default 'device'::attendance_source,
  device_serial text,
  academic_year text not null,
  created_at timestamp with time zone not null default now()
);

-- device_mapping
create table if not exists public.device_mapping (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  device_uid text not null,
  assigned_at timestamp with time zone not null default now(),
  is_active boolean not null default true
);

-- devices
create table if not exists public.devices (
  id uuid not null default gen_random_uuid(),
  serial_no text not null,
  label text,
  location text,
  is_active boolean not null default true,
  last_seen timestamp with time zone
);

-- duty_roster
create table if not exists public.duty_roster (
  id uuid not null default gen_random_uuid(),
  duty_date date not null,
  hijri_label text,
  week_label text,
  day_label text,
  name_a text,
  name_b text,
  user_a uuid,
  user_b uuid,
  note text
);

-- event_media
create table if not exists public.event_media (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  path text not null,
  caption text,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now()
);

-- event_participants
create table if not exists public.event_participants (
  id uuid not null default gen_random_uuid(),
  event_id uuid not null,
  student_id uuid not null,
  student_name text,
  class_label text,
  consent_sent_at timestamp with time zone,
  consent_at timestamp with time zone,
  consent_photo boolean,
  consent_note text,
  guardian_id uuid,
  permission_id uuid,
  attended boolean,
  attendance_note text,
  cert_issued_at timestamp with time zone,
  cert_doc_id uuid,
  created_at timestamp with time zone not null default now(),
  consent_doc_id uuid,
  consent_manual boolean not null default false,
  consent_by uuid,
  consent_by_name text,
  reminded_at timestamp with time zone
);

-- exam_slots
create table if not exists public.exam_slots (
  id uuid not null default gen_random_uuid(),
  exam_term_id uuid not null,
  class_id uuid,
  grade integer,
  schedule_id uuid,
  subject_id uuid,
  subject_name text,
  exam_date date,
  day_of_week integer,
  period_no integer,
  note text,
  created_at timestamp with time zone not null default now(),
  exam_week integer not null default 1
);

-- exam_terms
create table if not exists public.exam_terms (
  id uuid not null default gen_random_uuid(),
  kind text not null,
  title text not null,
  start_date date,
  end_date date,
  academic_year text,
  term integer,
  is_published boolean not null default false,
  note text,
  created_at timestamp with time zone not null default now()
);

-- excused_absences
create table if not exists public.excused_absences (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  date_from date not null,
  date_to date not null,
  excuse excuse_type not null,
  reason text,
  attachment_url text,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  academic_year text not null
);

-- feedback
create table if not exists public.feedback (
  id uuid not null default gen_random_uuid(),
  name text,
  contact text,
  role_label text,
  category text not null default 'other'::text,
  message text not null,
  page_url text,
  user_id uuid not null,
  status text not null default 'new'::text,
  admin_note text,
  created_at timestamp with time zone not null default now(),
  national_id text
);

-- feedback_replies
create table if not exists public.feedback_replies (
  id uuid not null default gen_random_uuid(),
  feedback_id uuid not null,
  sender_id uuid not null,
  sender_role text not null,
  message text not null default ''::text,
  attachment_url text,
  created_at timestamp with time zone not null default now()
);

-- form_counters
create table if not exists public.form_counters (
  year integer not null,
  category text not null,
  n integer not null default 0
);

-- form_documents
create table if not exists public.form_documents (
  id uuid not null default gen_random_uuid(),
  template_id uuid not null,
  serial text not null,
  title text not null,
  recipient text,
  student_id uuid,
  signature_path text,
  signature_name text,
  signature_role text,
  stamp_path text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'issued'::text,
  hijri_year integer not null,
  created_by uuid not null,
  created_at timestamp with time zone not null default now(),
  approved_by uuid,
  approved_at timestamp with time zone,
  decision_note text,
  printed_at timestamp with time zone,
  recipient_user_id uuid,
  sent_at timestamp with time zone,
  reply_signature_path text,
  reply_signature_name text,
  reply_at timestamp with time zone,
  co_signers jsonb not null default '[]'::jsonb
);

-- form_templates
create table if not exists public.form_templates (
  id uuid not null default gen_random_uuid(),
  key text not null,
  title text not null,
  category text not null default 'administrative'::text,
  description text,
  orientation text not null default 'portrait'::text,
  fields jsonb not null default '[]'::jsonb,
  allowed_roles text[] not null default '{}'::text[],
  requires_approval boolean not null default false,
  signature_source text not null default 'issuer'::text,
  show_stamp boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  presets jsonb not null default '[]'::jsonb,
  preset_field text default 'reason'::text,
  department text not null default 'school_admin'::text
);

-- grade_entries
create table if not exists public.grade_entries (
  id uuid not null default gen_random_uuid(),
  teacher_user_id uuid not null default auth.uid(),
  class_id text not null,
  subject_key text not null,
  academic_year text not null,
  term integer not null,
  student_id text not null,
  cell text not null,
  value text,
  updated_at timestamp with time zone not null default now()
);

-- grades_records
create table if not exists public.grades_records (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  subject_id uuid not null,
  term text not null,
  score numeric(5,2),
  max_score numeric(5,2) default 100,
  is_published boolean not null default false,
  published_at timestamp with time zone,
  published_by uuid,
  imported_at timestamp with time zone not null default now(),
  academic_year text not null,
  exam_period integer
);

-- guardian_student
create table if not exists public.guardian_student (
  id uuid not null default gen_random_uuid(),
  guardian_id uuid not null,
  student_id uuid not null,
  relation text,
  is_primary boolean not null default true
);

-- guardians
create table if not exists public.guardians (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  national_id text,
  full_name text not null,
  mobile text not null,
  sms_consent boolean not null default true,
  sms_opt_out_at timestamp with time zone,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- guides
create table if not exists public.guides (
  id uuid not null default gen_random_uuid(),
  title text not null,
  description text,
  audience text not null default 'general'::text,
  file_url text not null,
  file_name text,
  file_size bigint,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- import_logs
create table if not exists public.import_logs (
  id uuid not null default gen_random_uuid(),
  import_type text not null,
  file_name text,
  performed_by uuid,
  rows_inserted integer default 0,
  rows_updated integer default 0,
  rows_rejected integer default 0,
  rows_missing integer default 0,
  status import_status not null default 'running'::import_status,
  error_detail text,
  academic_year text,
  started_at timestamp with time zone not null default now(),
  finished_at timestamp with time zone
);

-- login_log
create table if not exists public.login_log (
  id uuid not null default gen_random_uuid(),
  national_id text not null,
  event_type text not null,
  success boolean not null default true,
  reason text,
  created_at timestamp with time zone not null default now()
);

-- maintenance_state
create table if not exists public.maintenance_state (
  id integer not null default 1,
  is_enabled boolean not null default false,
  message text,
  updated_by uuid,
  updated_at timestamp with time zone not null default now()
);

-- news
create table if not exists public.news (
  id uuid not null default gen_random_uuid(),
  title text not null,
  slug text,
  excerpt text,
  body text,
  cover_url text,
  is_published boolean not null default false,
  is_featured boolean not null default true,
  published_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  video_url text,
  cover_theme text,
  body_images text[] default '{}'::text[]
);

-- notification_drafts
create table if not exists public.notification_drafts (
  id uuid not null default gen_random_uuid(),
  title text not null,
  body text,
  kind text default 'general'::text,
  image_url text,
  attachment_url text,
  attachment_name text,
  youtube_url text,
  target_mode text not null,
  target_roles text[],
  target_grade integer,
  target_class_no integer,
  target_user_ids uuid[],
  sender_id uuid not null,
  sender_name text,
  status text not null default 'pending'::text,
  reject_reason text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- notification_recipients
create table if not exists public.notification_recipients (
  notification_id uuid not null,
  user_id uuid not null,
  read_at timestamp with time zone
);

-- notifications
create table if not exists public.notifications (
  id uuid not null default gen_random_uuid(),
  title text not null,
  body text,
  kind text not null default 'general'::text,
  link text,
  is_auto boolean not null default false,
  created_by uuid,
  created_at timestamp with time zone not null default now(),
  sender_name text,
  image_url text,
  attachment_url text,
  attachment_name text,
  youtube_url text
);

-- official_absence_notified
create table if not exists public.official_absence_notified (
  student_id uuid not null,
  attend_date date not null,
  created_at timestamp with time zone not null default now()
);

-- official_attendance_days
create table if not exists public.official_attendance_days (
  attend_date date not null,
  academic_year text,
  term integer,
  total integer not null default 0,
  present integer not null default 0,
  absent integer not null default 0,
  excused integer not null default 0,
  pending integer not null default 0,
  official_pct numeric(5,2),
  by_grade jsonb not null default '{}'::jsonb,
  late_count integer,
  approved_at timestamp with time zone not null default now(),
  approved_by uuid,
  approved_by_name text,
  retroactive boolean not null default false,
  updated_at timestamp with time zone,
  updated_by uuid,
  updated_by_name text,
  final_present integer,
  final_absent integer,
  final_excused integer,
  final_pending integer,
  final_pct numeric(5,2),
  final_by_grade jsonb,
  final_at timestamp with time zone
);

-- official_day_marks
create table if not exists public.official_day_marks (
  attend_date date not null,
  student_id uuid not null,
  status text not null,
  punched boolean not null default false,
  full_name text,
  national_id text,
  class_no integer,
  grade integer,
  manual boolean not null default false,
  note text,
  edited_by_name text,
  edited_at timestamp with time zone,
  punch_time timestamp with time zone,
  late_minutes integer
);

-- period_times
create table if not exists public.period_times (
  id uuid not null default gen_random_uuid(),
  season text not null,
  kind text not null default 'period'::text,
  period_no integer,
  label text not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  sort_order integer not null
);

-- permission_grantors
create table if not exists public.permission_grantors (
  user_id uuid not null,
  title text not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- permission_request_students
create table if not exists public.permission_request_students (
  request_id uuid not null,
  student_id uuid not null
);

-- permission_requests
create table if not exists public.permission_requests (
  id uuid not null default gen_random_uuid(),
  request_date date not null,
  scope text not null,
  period_numbers integer[],
  note text,
  created_by uuid not null,
  created_at timestamp with time zone not null default now()
);

-- permission_returns
create table if not exists public.permission_returns (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  return_date date not null,
  from_period integer not null,
  returned_by uuid,
  note text,
  created_at timestamp with time zone not null default now()
);

-- push_subscriptions
create table if not exists public.push_subscriptions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone not null default now()
);

-- quiz_assignments
create table if not exists public.quiz_assignments (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  student_id uuid not null,
  class_id uuid,
  started_at timestamp with time zone,
  deadline_at timestamp with time zone,
  submitted_at timestamp with time zone,
  draft jsonb not null default '{}'::jsonb,
  notified_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- quiz_classes
create table if not exists public.quiz_classes (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  class_id uuid not null,
  exam_date date
);

-- quiz_online
create table if not exists public.quiz_online (
  quiz_id uuid not null,
  opens_at timestamp with time zone not null,
  closes_at timestamp with time zone not null,
  duration_min integer not null default 15,
  show_result boolean not null default true,
  published_at timestamp with time zone not null default now()
);

-- quiz_questions
create table if not exists public.quiz_questions (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  sort_order integer not null default 0,
  kind text not null,
  text text not null,
  marks numeric(5,2) not null default 1,
  options jsonb,
  answer jsonb not null,
  hint text,
  created_at timestamp with time zone not null default now(),
  image_path text,
  image_width integer not null default 60
);

-- quiz_submissions
create table if not exists public.quiz_submissions (
  id uuid not null default gen_random_uuid(),
  quiz_id uuid not null,
  class_id uuid,
  student_id uuid not null,
  answers jsonb not null default '{}'::jsonb,
  score numeric(5,2),
  auto_score numeric(5,2),
  manual_add numeric(5,2) default 0,
  absent boolean not null default false,
  marked_at timestamp with time zone,
  marked_by uuid,
  note text
);

-- quizzes
create table if not exists public.quizzes (
  id uuid not null default gen_random_uuid(),
  teacher_id uuid not null,
  title text not null,
  subject_id uuid,
  subject_name text,
  grade integer,
  period text not null default 'period1'::text,
  total_marks numeric(5,2) not null default 20,
  instructions text,
  exam_date date,
  duration_min integer,
  academic_year text,
  term integer,
  status text not null default 'draft'::text,
  created_at timestamp with time zone not null default now(),
  lang text not null default 'ar'::text,
  gradebook_column text,
  posted_at timestamp with time zone,
  mode text not null default 'omr'::text,
  paper_opts jsonb not null default '{}'::jsonb
);

-- role_permissions
create table if not exists public.role_permissions (
  role_type admin_role_type not null,
  permission text not null
);

-- schedule
create table if not exists public.schedule (
  id uuid not null default gen_random_uuid(),
  teacher_id uuid not null,
  subject_id uuid,
  class_id uuid not null,
  day_of_week integer not null,
  period_no integer not null,
  start_time time without time zone,
  end_time time without time zone,
  academic_year text not null,
  term integer not null default 1
);

-- school_assets
create table if not exists public.school_assets (
  key text not null,
  path text not null,
  label text,
  updated_at timestamp with time zone not null default now(),
  updated_by uuid
);

-- school_events
create table if not exists public.school_events (
  id uuid not null default gen_random_uuid(),
  serial text,
  title text not null,
  category text,
  description text,
  goals text,
  venue text,
  event_date date not null,
  start_time time without time zone,
  end_time time without time zone,
  organizer_id uuid,
  organizer_name text,
  organizer_role text,
  stage text not null default 'draft'::text,
  cert_template text,
  cert_title text,
  cert_issued_at timestamp with time zone,
  report_summary text,
  report_outcome text,
  report_at timestamp with time zone,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  cert_text text,
  cancelled_at timestamp with time zone,
  cancel_reason text,
  cancelled_by_name text,
  report_outcomes text,
  report_recommendations text,
  report_photos text[] not null default '{}'::text[],
  report_submitted_at timestamp with time zone,
  approval_note text,
  approved_by_name text,
  co_organizers jsonb not null default '[]'::jsonb
);

-- settings
create table if not exists public.settings (
  key text not null,
  value text not null,
  updated_at timestamp with time zone not null default now()
);

-- site_status_snapshots
create table if not exists public.site_status_snapshots (
  day date not null,
  verdict text not null,
  checks jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  source text not null default 'scheduled'::text,
  created_at timestamp with time zone not null default now()
);

-- sms_logs
create table if not exists public.sms_logs (
  id uuid not null default gen_random_uuid(),
  guardian_id uuid,
  student_id uuid,
  mobile text not null,
  body text not null,
  msg_type text,
  status sms_status not null default 'queued'::sms_status,
  provider_ref text,
  error_detail text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

-- student_enrollment
create table if not exists public.student_enrollment (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  class_id uuid not null,
  academic_year text not null,
  status enrollment_status not null default 'active'::enrollment_status,
  created_at timestamp with time zone not null default now()
);

-- student_referrals
create table if not exists public.student_referrals (
  id uuid not null default gen_random_uuid(),
  serial text,
  student_id uuid not null,
  student_name text,
  class_label text,
  grade integer,
  teacher_id uuid,
  teacher_name text,
  subject text,
  period_no integer,
  referral_date date not null default CURRENT_DATE,
  reason text not null,
  done_in_class text,
  teacher_sig text,
  teacher_at timestamp with time zone default now(),
  deputy_id uuid,
  deputy_name text,
  deputy_note text,
  deputy_sig text,
  deputy_at timestamp with time zone,
  counselor_id uuid,
  counselor_name text,
  counselor_note text,
  counselor_sig text,
  counselor_at timestamp with time zone,
  close_note text,
  closed_at timestamp with time zone,
  return_note text,
  guardian_id uuid,
  guardian_ack_at timestamp with time zone,
  guardian_note text,
  status text not null default 'with_deputy'::text,
  created_at timestamp with time zone not null default now()
);

-- student_results
create table if not exists public.student_results (
  id uuid not null default gen_random_uuid(),
  student_id uuid not null,
  report_type text not null,
  academic_year text not null,
  average numeric(5,2),
  file_path text not null,
  published boolean not null default false,
  rank_class integer,
  class_count integer,
  rank_grade integer,
  grade_count integer,
  uploaded_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- students
create table if not exists public.students (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  national_id text not null,
  identity_type identity_type_enum not null default 'national'::identity_type_enum,
  previous_identity text,
  full_name text not null,
  birth_date text,
  nationality text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  device_uid text
);

-- subject_aliases
create table if not exists public.subject_aliases (
  id uuid not null default gen_random_uuid(),
  external_name text not null,
  grade integer not null,
  subject_name text not null,
  created_at timestamp with time zone not null default now()
);

-- subjects
create table if not exists public.subjects (
  id uuid not null default gen_random_uuid(),
  name text not null,
  grade integer,
  term integer,
  weekly_periods integer
);

-- substitute_periods
create table if not exists public.substitute_periods (
  id uuid not null default gen_random_uuid(),
  schedule_id uuid not null,
  class_id uuid not null,
  cover_teacher_id uuid not null,
  absent_teacher_id uuid,
  attend_date date not null,
  period_no integer not null,
  day_of_week integer not null,
  academic_year text not null,
  term integer,
  created_at timestamp with time zone not null default now()
);

-- supervision_duty
create table if not exists public.supervision_duty (
  id uuid not null default gen_random_uuid(),
  day_of_week integer not null,
  person_name text not null,
  kind text not null,
  user_id uuid
);

-- teacher_follow_up
create table if not exists public.teacher_follow_up (
  id uuid not null default gen_random_uuid(),
  teacher_id uuid not null,
  class_id uuid not null,
  subject text not null,
  academic_year text not null,
  term integer not null,
  period text not null,
  student_id uuid not null,
  item_key text not null,
  slot_no integer not null default 1,
  mark numeric(5,2),
  updated_at timestamp with time zone not null default now()
);

-- teacher_granted_tabs
create table if not exists public.teacher_granted_tabs (
  teacher_id uuid not null,
  tab_key text not null,
  granted_by uuid,
  created_at timestamp with time zone not null default now()
);

-- teacher_hidden_tabs
create table if not exists public.teacher_hidden_tabs (
  teacher_id uuid not null,
  tab_key text not null,
  created_at timestamp with time zone not null default now()
);

-- teachers
create table if not exists public.teachers (
  id uuid not null default gen_random_uuid(),
  user_id uuid,
  national_id text not null,
  full_name text not null,
  mobile text,
  specialization text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- unmatched_logs
create table if not exists public.unmatched_logs (
  id uuid not null default gen_random_uuid(),
  device_uid text not null,
  punch_time timestamp with time zone not null,
  device_serial text,
  resolved boolean not null default false,
  created_at timestamp with time zone not null default now()
);

-- user_signatures
create table if not exists public.user_signatures (
  user_id uuid not null,
  path text not null,
  updated_at timestamp with time zone not null default now()
);

-- users
create table if not exists public.users (
  id uuid not null,
  username text not null,
  role user_role not null,
  is_active boolean not null default true,
  must_change_pw boolean not null default true,
  last_login timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  full_name text,
  activated_at timestamp with time zone
);


-- ---------------------------------------------------------------------
--  2) الدوال — 98
-- ---------------------------------------------------------------------

-- _finish_online_attempt(p_assign uuid, p_answers jsonb)
CREATE OR REPLACE FUNCTION public._finish_online_attempt(p_assign uuid, p_answers jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a   public.quiz_assignments%rowtype;
  v_sub uuid;
  v_score numeric;
begin
  select * into a from quiz_assignments where id = p_assign for update;
  if a.id is null or a.submitted_at is not null then return null; end if;

  select id into v_sub from quiz_submissions
   where quiz_id = a.quiz_id and student_id = a.student_id limit 1;

  if v_sub is null then
    insert into quiz_submissions (quiz_id, class_id, student_id, answers, absent)
    values (a.quiz_id, a.class_id, a.student_id, coalesce(p_answers, '{}'::jsonb), false)
    returning id into v_sub;
  else
    update quiz_submissions
       set answers = coalesce(p_answers, '{}'::jsonb), absent = false,
           class_id = coalesce(class_id, a.class_id)
     where id = v_sub;
  end if;

  v_score := public.grade_submission(v_sub);

  update quiz_assignments
     set submitted_at = now(), draft = coalesce(p_answers, '{}'::jsonb)
   where id = a.id;

  -- إن كان المعلم اختار إظهار النتيجة فورًا: تظهر أيضًا في «نتائج الاختبارات»
  if exists (select 1 from quiz_online o where o.quiz_id = a.quiz_id and o.show_result) then
    update quizzes set status = 'marking' where id = a.quiz_id and status in ('draft', 'ready');
  end if;

  return v_score;
end $function$
;

-- _sweep_online_quiz(p_quiz uuid)
CREATE OR REPLACE FUNCTION public._sweep_online_quiz(p_quiz uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record;
  v_closed boolean;
begin
  for r in select id, draft from quiz_assignments
            where quiz_id = p_quiz and submitted_at is null
              and started_at is not null and deadline_at + interval '1 minute' < now()
  loop
    perform public._finish_online_attempt(r.id, r.draft);
  end loop;

  select closes_at + interval '1 minute' < now() into v_closed
    from quiz_online where quiz_id = p_quiz;
  if coalesce(v_closed, false) then
    insert into quiz_submissions (quiz_id, class_id, student_id, answers, absent)
    select a.quiz_id, a.class_id, a.student_id, '{}'::jsonb, true
      from quiz_assignments a
     where a.quiz_id = p_quiz and a.started_at is null
       and not exists (select 1 from quiz_submissions s
                        where s.quiz_id = a.quiz_id and s.student_id = a.student_id);
  end if;
end $function$
;

-- activation_stats()
CREATE OR REPLACE FUNCTION public.activation_stats()
 RETURNS TABLE(role text, total bigint, activated bigint, unactivated bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    role::text,
    count(*) as total,
    count(*) filter (where must_change_pw = false) as activated,
    count(*) filter (where must_change_pw = true) as unactivated
  from users
  where is_active = true
  group by role::text;
$function$
;

-- active_term()
CREATE OR REPLACE FUNCTION public.active_term()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce((select value::int from public.settings where key = 'active_term'), 1);
$function$
;

-- active_year()
CREATE OR REPLACE FUNCTION public.active_year()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select value from public.settings where key = 'active_year';
$function$
;

-- admin_db_stats()
CREATE OR REPLACE FUNCTION public.admin_db_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ok boolean;
  result json;
begin
  -- يُسمح للإدارة، وللدالة المجدولة (مفتاح الخدمة) عند حفظ اللقطة اليومية
  select coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or exists (
        select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
      ) into ok;
  if not ok then
    raise exception 'forbidden';
  end if;

  select json_build_object(
    'db_bytes',        pg_database_size(current_database()),
    'storage_bytes',   coalesce((select sum((metadata->>'size')::bigint) from storage.objects), 0),
    'storage_objects', (select count(*) from storage.objects),
    'top_tables', (
      select coalesce(json_agg(t), '[]'::json) from (
        select c.relname as name,
               pg_total_relation_size(c.oid) as bytes
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by pg_total_relation_size(c.oid) desc
        limit 6
      ) t
    )
  ) into result;

  return result;
end;
$function$
;

-- admin_logins_by_day(days integer)
CREATE OR REPLACE FUNCTION public.admin_logins_by_day(days integer DEFAULT 7)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ok boolean;
  result json;
begin
  select exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'admin'
  ) into ok;
  if not ok then
    raise exception 'forbidden';
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.day), '[]'::json) into result
  from (
    select to_char(d::date, 'YYYY-MM-DD') as day,
           (select count(*) from public.login_log l
             where l.event_type = 'login' and l.success = true
               and l.created_at >= d::date and l.created_at < (d::date + 1)) as count
    from generate_series(current_date - (greatest(days, 1) - 1), current_date, interval '1 day') d
  ) t;

  return result;
end;
$function$
;

-- ar_norm(t text)
CREATE OR REPLACE FUNCTION public.ar_norm(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select regexp_replace(
           translate(coalesce(t, ''), 'أإآٱةى', 'ااااهي'),
           '[\u064B-\u0652\u0640]', '', 'g');
$function$
;

-- ca_block_early_marking()
CREATE OR REPLACE FUNCTION public.ca_block_early_marking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now    timestamp := now() at time zone 'Asia/Riyadh';
  v_season text;
  v_start  time;
begin
  if auth.uid() is null or public.sa_is_staff() then
    return new;
  end if;

  if new.attend_date > v_now::date then
    raise exception 'لا يمكن تحضير يوم لم يأتِ بعد.' using errcode = 'check_violation';
  end if;

  if new.attend_date < v_now::date then
    return new;
  end if;

  select coalesce((select value from public.settings where key = 'active_season'), 'summer')
    into v_season;

  select pt.start_time::time into v_start
  from public.schedule s
  join public.period_times pt
    on pt.kind = 'period' and pt.period_no = s.period_no and pt.season = v_season
  where s.id = new.schedule_id
  limit 1;

  if v_start is not null and v_now::time < v_start then
    raise exception 'لم تبدأ هذه الحصة بعد — يُفتح تحضيرها الساعة %', to_char(v_start, 'HH12:MI')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$function$
;

-- can_raise_permission(uid uuid)
CREATE OR REPLACE FUNCTION public.can_raise_permission(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select is_admin(uid) or is_active_grantor(uid);
$function$
;

-- clear_must_change_pw()
CREATE OR REPLACE FUNCTION public.clear_must_change_pw()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update users
  set must_change_pw = false,
      activated_at = coalesce(activated_at, now())
  where id = auth.uid();
end $function$
;

-- clear_today_device_punches()
CREATE OR REPLACE FUNCTION public.clear_today_device_punches()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n integer;
begin
  -- بصمات اليوم من الجهاز فقط (لا يمسّ الرصد اليدوي للمعلمين)
  delete from daily_attendance
  where attend_date = current_date and source = 'device';
  get diagnostics n = row_count;

  -- سجلات الأرقام غير المطابقة لليوم (ناتجة عن التجربة أيضًا)
  delete from unmatched_logs
  where punch_time::date = current_date;

  return n;
end;
$function$
;

-- close_online_quiz(p_quiz uuid)
CREATE OR REPLACE FUNCTION public.close_online_quiz(p_quiz uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from quizzes where id = p_quiz and teacher_id = auth.uid()) then
    raise exception 'غير مصرّح';
  end if;
  update quiz_online set closes_at = now() - interval '2 minutes',
                         opens_at = least(opens_at, now() - interval '3 minutes')
   where quiz_id = p_quiz;
  update quiz_assignments set deadline_at = least(deadline_at, now() - interval '2 minutes')
   where quiz_id = p_quiz and submitted_at is null and started_at is not null;
  perform public._sweep_online_quiz(p_quiz);
end $function$
;

-- current_guardian_id()
CREATE OR REPLACE FUNCTION public.current_guardian_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.guardians
  where user_id = (select auth.uid()) and is_active;
$function$
;

-- current_student_id()
CREATE OR REPLACE FUNCTION public.current_student_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.students
  where user_id = (select auth.uid()) and is_active;
$function$
;

-- current_teacher_id()
CREATE OR REPLACE FUNCTION public.current_teacher_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id from public.teachers
  where user_id = (select auth.uid()) and is_active;
$function$
;

-- current_user_role()
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role
  from public.users
  where id = (select auth.uid())
    and is_active;
$function$
;

-- ev_is_manager(p_event uuid, p_roles text[])
CREATE OR REPLACE FUNCTION public.ev_is_manager(p_event uuid, p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.school_events e
    where e.id = p_event
      and (e.organizer_id = auth.uid() or public.has_admin_role(p_roles))
  );
$function$
;

-- ev_is_participant(p_event uuid)
CREATE OR REPLACE FUNCTION public.ev_is_participant(p_event uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.event_participants p
    join public.students s on s.id = p.student_id
    where p.event_id = p_event and s.user_id = auth.uid()
  ) or exists (
    select 1 from public.event_participants p
    join public.guardian_student gs on gs.student_id = p.student_id
    join public.guardians g on g.id = gs.guardian_id
    where p.event_id = p_event and g.user_id = auth.uid()
  );
$function$
;

-- ev_participant_guardians(p_event uuid)
CREATE OR REPLACE FUNCTION public.ev_participant_guardians(p_event uuid)
 RETURNS TABLE(student_id uuid, user_id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct on (p.student_id, g.user_id) p.student_id, g.user_id, g.full_name
  from public.event_participants p
  join public.guardian_student gs on gs.student_id = p.student_id
  join public.guardians g on g.id = gs.guardian_id
  where p.event_id = p_event
    and g.user_id is not null
    and public.ev_is_manager(p_event, array['principal', 'tech_support', 'deputy_students']);
$function$
;

-- ev_sync_consent_signers(p_event uuid)
CREATE OR REPLACE FUNCTION public.ev_sync_consent_signers(p_event uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  ev public.school_events%rowtype;
  n  integer;
begin
  select * into ev from public.school_events where id = p_event;
  if not found then raise exception 'الحدث غير موجود'; end if;

  if not (
    ev.organizer_id = auth.uid()
    or exists (select 1 from jsonb_array_elements(coalesce(ev.co_organizers, '[]'::jsonb)) c
               where c->>'user_id' = auth.uid()::text)
    or exists (select 1 from public.admin_roles r
               where r.user_id = auth.uid() and r.role_type in ('principal', 'tech_support'))
  ) then
    raise exception 'لا تملك صلاحية تعديل موافقات هذا الحدث';
  end if;

  update public.form_documents d
  set signature_name = coalesce(nullif(ev.organizer_name, ''), d.signature_name, ''),
      signature_role = case when coalesce(ev.organizer_role, '') in ('', 'معلم') then 'المعلم'
                            else ev.organizer_role end,
      co_signers     = coalesce(ev.co_organizers, '[]'::jsonb)
  from public.event_participants ep
  where ep.event_id = ev.id and ep.consent_doc_id = d.id;

  get diagnostics n = row_count;
  return n;
end;
$function$
;

-- ev_teacher_directory()
CREATE OR REPLACE FUNCTION public.ev_teacher_directory()
 RETURNS TABLE(user_id uuid, full_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.user_id, t.full_name
  from public.teachers t
  where t.user_id is not null and auth.uid() is not null
  order by t.full_name;
$function$
;

-- fd_can_use_template(p_template uuid)
CREATE OR REPLACE FUNCTION public.fd_can_use_template(p_template uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with me as (
    select auth.uid() as uid
  ),
  my_roles as (
    select ar.role_type::text as r from public.admin_roles ar, me where ar.user_id = me.uid
  ),
  allowed as (
    -- to_jsonb يقبل العمود نصًّا مصفوفًا أو jsonb
    select jsonb_array_elements_text(coalesce(to_jsonb(t.allowed_roles), '[]'::jsonb)) as r
    from public.form_templates t where t.id = p_template
  )
  select
    exists (select 1 from my_roles where r in ('principal', 'tech_support'))
    or exists (select 1 from allowed a join my_roles m on m.r = a.r)
    or (exists (select 1 from allowed where r = 'admin')
        and exists (select 1 from public.users u, me where u.id = me.uid and u.role = 'admin'))
    or (exists (select 1 from allowed where r = 'teacher')
        and (exists (select 1 from public.users u, me where u.id = me.uid and u.role = 'teacher')
             or exists (select 1 from public.teachers t, me where t.user_id = me.uid)));
$function$
;

-- fd_guard_self_issue()
CREATE OR REPLACE FUNCTION public.fd_guard_self_issue()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.fd_is_self_issued(new) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status in ('issued', 'approved') then
      new.status := 'pending';
      new.approved_by := null;
      new.approved_at := null;
    end if;
    return new;
  end if;

  -- التعديل: الإصدار أو الاعتماد لمدير المدرسة فقط
  if new.status in ('issued', 'approved')
     and old.status is distinct from new.status
     and not exists (
       select 1 from public.admin_roles ar
       where ar.user_id = auth.uid() and ar.role_type = 'principal'
     ) then
    raise exception 'المستند باسم مُصدِره، فلا يُعتمد إلا من مدير المدرسة';
  end if;

  return new;
end;
$function$
;

-- fd_guard_template_use()
CREATE OR REPLACE FUNCTION public.fd_guard_template_use()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- العمليات الخلفية (بلا مستخدم) لا تُقيَّد
  if auth.uid() is null then
    return new;
  end if;
  if not public.fd_can_use_template(new.template_id) then
    raise exception 'لا تملك صلاحية إصدار هذا النموذج';
  end if;
  return new;
end;
$function$
;

-- fd_is_self_issued(p_doc form_documents)
CREATE OR REPLACE FUNCTION public.fd_is_self_issued(p_doc form_documents)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- coalesce: المستفيد بلا حساب (null) يعني «ليس هو»، لا «غير معروف»
  select coalesce(p_doc.created_by is not null and (
    p_doc.recipient_user_id = p_doc.created_by
    or exists (
      select 1 from public.users u
      where u.id = p_doc.created_by
        and nullif(regexp_replace(trim(u.full_name), '\s+', ' ', 'g'), '') =
            regexp_replace(trim(coalesce(p_doc.recipient, '')), '\s+', ' ', 'g')
    )
  ), false);
$function$
;

-- get_online_quiz(p_quiz uuid)
CREATE OR REPLACE FUNCTION public.get_online_quiz(p_quiz uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a   public.quiz_assignments%rowtype;
  o   public.quiz_online%rowtype;
  qz  public.quizzes%rowtype;
  v_state text;
  v_qs jsonb := null;
  v_res jsonb := null;
begin
  select a2.* into a from quiz_assignments a2 join students s on s.id = a2.student_id
   where a2.quiz_id = p_quiz and s.user_id = auth.uid();
  if a.id is null then return jsonb_build_object('state', 'not_assigned'); end if;

  -- محاولة انتهى وقتها ولم تُسلَّم (أُغلق المتصفح مثلًا) ⇒ تُسلَّم بما حُفظ
  if a.submitted_at is null and a.started_at is not null
     and a.deadline_at + interval '1 minute' < now() then
    perform public._finish_online_attempt(a.id, a.draft);
    select * into a from quiz_assignments where id = a.id;
  end if;

  select * into o  from quiz_online where quiz_id = p_quiz;
  select * into qz from quizzes     where id = p_quiz;

  v_state := case
    when a.submitted_at is not null then 'submitted'
    when a.started_at   is not null then 'in_progress'
    when now() < o.opens_at         then 'upcoming'
    when now() >= o.closes_at       then 'closed'
    else 'open' end;

  if v_state = 'in_progress' then
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'kind', x.kind, 'text', x.text, 'marks', x.marks,
             'options', x.options, 'sort_order', x.sort_order) order by x.sort_order)
      into v_qs from quiz_questions x where x.quiz_id = p_quiz;
  end if;

  if v_state = 'submitted' and o.show_result then
    select jsonb_build_object('score', s.score, 'total', qz.total_marks) into v_res
      from quiz_submissions s where s.quiz_id = p_quiz and s.student_id = a.student_id limit 1;
  end if;

  return jsonb_build_object(
    'state', v_state,
    'now', now(),
    'quiz', jsonb_build_object('id', qz.id, 'title', qz.title, 'subject_name', qz.subject_name,
                               'total_marks', qz.total_marks, 'instructions', qz.instructions,
                               'lang', qz.lang),
    'online', jsonb_build_object('opens_at', o.opens_at, 'closes_at', o.closes_at,
                                 'duration_min', o.duration_min, 'show_result', o.show_result),
    'attempt', jsonb_build_object('started_at', a.started_at, 'deadline_at', a.deadline_at,
                                  'submitted_at', a.submitted_at,
                                  'draft', case when v_state = 'in_progress' then a.draft end),
    'questions', v_qs,
    'result', v_res);
end $function$
;

-- grade_submission(p_submission uuid)
CREATE OR REPLACE FUNCTION public.grade_submission(p_submission uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  v_quiz uuid; v_answers jsonb; total numeric := 0; q record; given jsonb;
begin
  select quiz_id, answers into v_quiz, v_answers
    from public.quiz_submissions where id = p_submission;
  if v_quiz is null then return 0; end if;

  for q in select id, kind, marks, answer from public.quiz_questions where quiz_id = v_quiz loop
    given := v_answers -> q.id::text;
    if given is null then continue; end if;

    if q.kind in ('mcq', 'truefalse') then
      -- تطابق تام للحرف أو القيمة
      if lower(trim(both '"' from given::text)) = lower(trim(both '"' from q.answer::text)) then
        total := total + q.marks;
      end if;

    elsif q.kind = 'match' then
      -- المزاوجة: درجة جزئية بعدد التطابقات الصحيحة
      declare hits int := 0; cnt int := 0;
      begin
        select count(*) into cnt from jsonb_object_keys(q.answer);
        if cnt > 0 then
          select count(*) into hits
            from jsonb_each_text(q.answer) k
           where given ->> k.key = k.value;
          total := total + (q.marks * hits / cnt);
        end if;
      end;
    end if;
  end loop;

  update public.quiz_submissions
     set auto_score = round(total, 2),
         score = round(total + coalesce(manual_add, 0), 2),
         marked_at = now()
   where id = p_submission;

  return round(total, 2);
end $function$
;

-- guard_quiz_limits()
CREATE OR REPLACE FUNCTION public.guard_quiz_limits()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  n int;
  lim int;
begin
  select coalesce((select value::int from public.settings
                    where key = 'quiz_max_' || new.kind), 99) into lim;

  select count(*) into n from public.quiz_questions
   where quiz_id = new.quiz_id and kind = new.kind
     and (TG_OP = 'INSERT' or id <> new.id);

  if n >= lim then
    raise exception 'بلغت الحد الأعلى لهذا النمط (%). التصميم يتّسع لهذا العدد فقط.', lim;
  end if;

  -- فقرات المزاوجة
  if new.kind = 'match' then
    select coalesce((select value::int from public.settings
                      where key = 'quiz_max_match_items'), 5) into lim;
    if jsonb_array_length(coalesce(new.options->'left', '[]'::jsonb)) > lim then
      raise exception 'الحد الأعلى لفقرات المزاوجة % فقرات.', lim;
    end if;
  end if;

  return new;
end $function$
;

-- has_admin_role(p_role admin_role_type)
CREATE OR REPLACE FUNCTION public.has_admin_role(p_role admin_role_type)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.admin_roles ar
    join public.users u on u.id = ar.user_id
    where ar.user_id = (select auth.uid())
      and ar.role_type = p_role
      and u.is_active
  );
$function$
;

-- has_admin_role(p_roles text[])
CREATE OR REPLACE FUNCTION public.has_admin_role(p_roles text[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select exists (
    select 1 from public.admin_roles r
     where r.user_id = auth.uid() and r.role_type::text = any(p_roles)
  );
$function$
;

-- has_any_admin_role(p_roles admin_role_type[])
CREATE OR REPLACE FUNCTION public.has_any_admin_role(p_roles admin_role_type[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.admin_roles ar
    join public.users u on u.id = ar.user_id
    where ar.user_id = (select auth.uid())
      and ar.role_type = any(p_roles)
      and u.is_active
  );
$function$
;

-- has_permission(perm text)
CREATE OR REPLACE FUNCTION public.has_permission(perm text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from admin_roles ar
    where ar.user_id = auth.uid()
      and (
        ar.role_type in ('principal', 'tech_support')
        or exists (
          select 1 from role_permissions rp
          where rp.role_type = ar.role_type and rp.permission = perm
        )
      )
  );
$function$
;

-- hide_reports_for_new_teacher()
CREATE OR REPLACE FUNCTION public.hide_reports_for_new_teacher()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into teacher_hidden_tabs (teacher_id, tab_key)
  values (new.id, 'reports')
  on conflict (teacher_id, tab_key) do nothing;
  return new;
end $function$
;

-- is_active_grantor(uid uuid)
CREATE OR REPLACE FUNCTION public.is_active_grantor(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from permission_grantors where user_id = uid and active = true
  );
$function$
;

-- is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(public.current_user_role() = 'admin', false);
$function$
;

-- is_admin(uid uuid)
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists (
    select 1 from users where id = uid and role = 'admin' and is_active = true
  );
$function$
;

-- is_excused(p_student uuid, p_date date)
CREATE OR REPLACE FUNCTION public.is_excused(p_student uuid, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.excused_absences
    where student_id = p_student
      and p_date between date_from and date_to
  );
$function$
;

-- is_form_approver()
CREATE OR REPLACE FUNCTION public.is_form_approver()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = auth.uid() and r.role_type = 'principal'
  );
$function$
;

-- is_form_manager()
CREATE OR REPLACE FUNCTION public.is_form_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = auth.uid() and r.role_type in ('tech_support', 'principal')
  );
$function$
;

-- is_guardian_of(p_student uuid)
CREATE OR REPLACE FUNCTION public.is_guardian_of(p_student uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.guardian_student
    where guardian_id = public.current_guardian_id()
      and student_id  = p_student
  );
$function$
;

-- is_site_monitor()
CREATE OR REPLACE FUNCTION public.is_site_monitor()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.admin_roles r
    where r.user_id = auth.uid() and r.role_type in ('tech_support', 'principal')
  );
$function$
;

-- is_tech_support()
CREATE OR REPLACE FUNCTION public.is_tech_support()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.admin_roles
    where user_id = auth.uid() and role_type = 'tech_support'
  );
$function$
;

-- link_duty_names()
CREATE OR REPLACE FUNCTION public.link_duty_names()
 RETURNS TABLE(tbl text, matched integer, unmatched integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare m1 int; u1 int; m2 int; u2 int;
begin
  update public.duty_roster d
     set user_a = u.id
    from public.users u
   where d.user_a is null and d.name_a is not null and u.full_name is not null
     and u.role in ('teacher', 'admin')
     and public.name_head(u.full_name) = public.name_head(d.name_a)
     and public.name_tail(u.full_name) = public.name_tail(d.name_a);

  update public.duty_roster d
     set user_b = u.id
    from public.users u
   where d.user_b is null and d.name_b is not null and u.full_name is not null
     and u.role in ('teacher', 'admin')
     and public.name_head(u.full_name) = public.name_head(d.name_b)
     and public.name_tail(u.full_name) = public.name_tail(d.name_b);

  update public.supervision_duty s
     set user_id = u.id
    from public.users u
   where s.user_id is null and u.full_name is not null
     and u.role in ('teacher', 'admin')
     and public.name_head(u.full_name) = public.name_head(s.person_name)
     and public.name_tail(u.full_name) = public.name_tail(s.person_name);

  select count(*) filter (where user_a is not null),
         count(*) filter (where user_a is null and name_a is not null)
    into m1, u1 from public.duty_roster;
  select count(*) filter (where user_id is not null),
         count(*) filter (where user_id is null)
    into m2, u2 from public.supervision_duty;

  return query values ('duty_roster', m1, u1), ('supervision_duty', m2, u2);
end $function$
;

-- marked_schedule_ids(p_date date)
CREATE OR REPLACE FUNCTION public.marked_schedule_ids(p_date date)
 RETURNS TABLE(schedule_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select distinct ca.schedule_id
  from class_attendance ca
  where ca.attend_date = p_date;
$function$
;

-- missing_students(p_date date)
CREATE OR REPLACE FUNCTION public.missing_students(p_date date)
 RETURNS TABLE(student_id uuid, full_name text, class_no integer, grade integer, last_seen_period integer, missing_period integer, subject text, teacher text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with early_presence as (
    -- حضوره المؤكد في الحصة الأولى أو الثانية (أيًّا منهما أُخذت)
    select
      ca.student_id,
      max(sc.period_no) filter (where ca.status <> 'absent') as last_seen_period
    from class_attendance ca
    join schedule sc on sc.id = ca.schedule_id and sc.period_no in (1, 2)
    where ca.attend_date = p_date
    group by ca.student_id
    having max(sc.period_no) filter (where ca.status <> 'absent') is not null
  ),
  later_absence as (
    -- أول غياب مؤكد في حصة لاحقة حُضِّرت فعليًا
    select distinct on (ca.student_id)
      ca.student_id,
      sc.period_no,
      sub.name as subject,
      t.full_name as teacher
    from class_attendance ca
    join schedule sc on sc.id = ca.schedule_id and sc.period_no > 2
    left join subjects sub on sub.id = sc.subject_id
    left join teachers t on t.id = sc.teacher_id
    where ca.attend_date = p_date
      and ca.status = 'absent'
    order by ca.student_id, sc.period_no asc
  )
  select
    v.student_id, v.full_name, v.class_no, v.grade,
    ep.last_seen_period, la.period_no as missing_period,
    la.subject, la.teacher
  from later_absence la
  join early_presence ep on ep.student_id = la.student_id
  join v_active_students v on v.student_id = la.student_id
  order by v.class_no, v.full_name;
$function$
;

-- my_duty_schedule(p_user uuid)
CREATE OR REPLACE FUNCTION public.my_duty_schedule(p_user uuid)
 RETURNS TABLE(kind text, day_label text, duty_date date, hijri_label text, partner text)
 LANGUAGE sql
 STABLE
AS $function$
  -- أيام المناوبة
  select 'duty'::text,
         d.day_label,
         d.duty_date,
         d.hijri_label,
         case when d.user_a = p_user then d.name_b else d.name_a end
    from public.duty_roster d
   where p_user in (d.user_a, d.user_b)
     and d.duty_date >= current_date - 7
  union all
  -- أيام الإشراف الأسبوعي
  select 'supervision'::text,
         case s.day_of_week when 1 then 'الأحد' when 2 then 'الاثنين'
                            when 3 then 'الثلاثاء' when 4 then 'الأربعاء'
                            else 'الخميس' end,
         null::date,
         null::text,
         s.kind
    from public.supervision_duty s
   where s.user_id = p_user
   order by 1 desc, 3;
$function$
;

-- my_form_roles()
CREATE OR REPLACE FUNCTION public.my_form_roles()
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    array(select u.role::text from public.users u where u.id = auth.uid())
    || array(select r.role_type::text from public.admin_roles r where r.user_id = auth.uid()),
    '{}'::text[]
  );
$function$
;

-- my_online_quizzes()
CREATE OR REPLACE FUNCTION public.my_online_quizzes()
 RETURNS TABLE(quiz_id uuid, title text, subject_name text, opens_at timestamp with time zone, closes_at timestamp with time zone, duration_min integer, started_at timestamp with time zone, deadline_at timestamp with time zone, submitted_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select q.id, q.title, q.subject_name, o.opens_at, o.closes_at, o.duration_min,
         a.started_at, a.deadline_at, a.submitted_at
    from quiz_assignments a
    join students s     on s.id = a.student_id and s.user_id = auth.uid()
    join quizzes q      on q.id = a.quiz_id
    join quiz_online o  on o.quiz_id = a.quiz_id
   where o.closes_at > now() - interval '3 days'
   order by (a.submitted_at is null) desc, o.closes_at;
$function$
;

-- my_quiz_results(p_student uuid)
CREATE OR REPLACE FUNCTION public.my_quiz_results(p_student uuid)
 RETURNS TABLE(quiz_id uuid, title text, subject_name text, period text, exam_date date, score numeric, total numeric, absent boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select q.id, q.title, q.subject_name, q.period, q.exam_date,
         sub.score, q.total_marks, sub.absent
    from public.quiz_submissions sub
    join public.quizzes q on q.id = sub.quiz_id
   where sub.student_id = p_student
     and q.status in ('marking', 'closed')
   order by q.exam_date desc nulls last, q.created_at desc;
$function$
;

-- name_head(t text)
CREATE OR REPLACE FUNCTION public.name_head(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select public.ar_norm(split_part(regexp_replace(coalesce(t,''), '\mبن\M', '', 'g'), ' ', 1));
$function$
;

-- name_tail(t text)
CREATE OR REPLACE FUNCTION public.name_tail(t text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select public.ar_norm(
           reverse(split_part(reverse(trim(regexp_replace(coalesce(t,''), '\s+', ' ', 'g'))), ' ', 1)));
$function$
;

-- next_event_serial()
CREATE OR REPLACE FUNCTION public.next_event_serial()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare y text; n int;
begin
  select to_char(current_date, 'YYYY') into y;
  select coalesce(max(substring(serial from '\d+$')::int), 0) + 1 into n
    from public.school_events where serial like 'EVT-' || y || '-%';
  return 'EVT-' || y || '-' || lpad(n::text, 4, '0');
end $function$
;

-- next_form_serial(p_category text, p_hijri_year integer)
CREATE OR REPLACE FUNCTION public.next_form_serial(p_category text, p_hijri_year integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  seq int;
  prefix text;
begin
  prefix := case p_category
              when 'certificate'    then 'CER'
              when 'official'       then 'OFC'
              else 'ADM'
            end;

  insert into public.form_counters (year, category, n)
  values (p_hijri_year, p_category, 1)
  on conflict (year, category)
  do update set n = public.form_counters.n + 1
  returning n into seq;

  return prefix || '-' || p_hijri_year::text || '-' || lpad(seq::text, 4, '0');
end;
$function$
;

-- next_referral_serial()
CREATE OR REPLACE FUNCTION public.next_referral_serial()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare y text; n int;
begin
  select to_char(current_date, 'YYYY') into y;
  select coalesce(max(substring(serial from '\d+$')::int), 0) + 1 into n
    from public.student_referrals where serial like 'REF-' || y || '-%';
  return 'REF-' || y || '-' || lpad(n::text, 4, '0');
end $function$
;

-- normalize_id(p_id text)
CREATE OR REPLACE FUNCTION public.normalize_id(p_id text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  s text;
begin
  if p_id is null then return null; end if;

  s := translate(p_id,
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789');

  s := regexp_replace(s, '[^0-9A-Za-z]', '', 'g');

  if length(s) between 5 and 20 then
    return s;
  end if;

  return null;   -- غير صالح
end;
$function$
;

-- normalize_mobile(p_mobile text)
CREATE OR REPLACE FUNCTION public.normalize_mobile(p_mobile text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  m text;
begin
  if p_mobile is null then return null; end if;

  -- إزالة كل ما ليس رقمًا (يشمل + والمسافات والشرطات)
  m := regexp_replace(p_mobile, '[^0-9]', '', 'g');

  -- 00966XXXXXXXXX  ←  966XXXXXXXXX
  if m like '00966%' then
    m := substring(m from 3);
  end if;

  -- 05XXXXXXXX  ←  9665XXXXXXXX
  if length(m) = 10 and left(m,1) = '0' then
    m := '966' || substring(m from 2);
  end if;

  -- 5XXXXXXXX  ←  9665XXXXXXXX
  if length(m) = 9 and left(m,1) = '5' then
    m := '966' || m;
  end if;

  if length(m) = 12 and left(m,3) = '966' then
    return m;
  end if;

  return null;   -- غير صالح
end;
$function$
;

-- notify_absence()
CREATE OR REPLACE FUNCTION public.notify_absence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_student   record;
  v_period    int;
  v_subject   text;
  v_title     text;
  v_body      text;
  v_ids       uuid[];
begin
  -- الغياب فقط، وعند التسجيل أو التحويل إليه
  if new.status <> 'absent' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'absent' then return new; end if;

  select s.full_name, s.user_id into v_student
  from students s where s.id = new.student_id;

  if v_student is null then return new; end if;

  select sc.period_no, sub.name into v_period, v_subject
  from schedule sc
  left join subjects sub on sub.id = sc.subject_id
  where sc.id = new.schedule_id;

  v_title := 'تسجيل غياب';
  v_body  := coalesce(v_student.full_name, 'الطالب')
             || ' — الحصة ' || coalesce(v_period::text, '?')
             || coalesce(' · ' || v_subject, '')
             || ' بتاريخ ' || to_char(new.attend_date, 'DD/MM/YYYY');

  -- الطالب + أولياء أمره
  select array_remove(array_agg(uid), null) into v_ids
  from (
    select v_student.user_id as uid
    union
    select g.user_id
    from guardian_student gs
    join guardians g on g.id = gs.guardian_id
    where gs.student_id = new.student_id
  ) t;

  if v_ids is not null and array_length(v_ids, 1) > 0 then
    perform send_notification(
      v_title, v_body, 'absence', '/',
      null, v_ids, null, null, true
    );
  end if;

  return new;
end $function$
;

-- notify_morning_tardy()
CREATE OR REPLACE FUNCTION public.notify_morning_tardy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_season   text;
  v_p1_start time;
  v_grace    int;
  v_deadline timestamp;
  v_punch    timestamp;
  v_student  record;
  v_ids      uuid[];
  v_nid      uuid;
  v_body     text;
begin
  -- موسم التوقيت النشط (صيفي/شتوي)
  select value into v_season from settings where key = 'active_season';
  v_season := coalesce(v_season, 'summer');

  -- بداية الحصة الأولى لهذا الموسم
  select start_time into v_p1_start
  from period_times
  where season = v_season and kind = 'period' and period_no = 1
  limit 1;
  if v_p1_start is null then return new; end if;

  -- مهلة السماح بالدقائق (افتراضي 0)
  select coalesce(nullif(value, '')::int, 0) into v_grace
  from settings where key = 'late_grace_minutes';
  v_grace := coalesce(v_grace, 0);

  -- وقت البصمة والموعد النهائي بتوقيت الرياض (وقت الحائط)
  v_punch    := (new.punch_time at time zone 'Asia/Riyadh');
  v_deadline := new.attend_date + v_p1_start + make_interval(mins => v_grace);

  if v_punch <= v_deadline then return new; end if;   -- ليست متأخرة

  select s.full_name, s.user_id into v_student
  from students s where s.id = new.student_id;
  if v_student is null then return new; end if;

  v_body := coalesce(v_student.full_name, 'الطالب')
            || ' — تأخّر عن الحضور الصباحي، سُجّلت بصمته الساعة '
            || to_char(v_punch, 'HH24:MI')
            || ' بتاريخ ' || to_char(new.attend_date, 'DD/MM/YYYY');

  -- الطالب + أولياء أمره
  select array_remove(array_agg(uid), null) into v_ids
  from (
    select v_student.user_id as uid
    union
    select g.user_id
    from guardian_student gs
    join guardians g on g.id = gs.guardian_id
    where gs.student_id = new.student_id
  ) t;

  if v_ids is not null and array_length(v_ids, 1) > 0 then
    v_nid := send_notification(
      'تأخر صباحي', v_body, 'alert', '/',
      null, v_ids, null, null, true
    );
    perform push_notification(v_nid);
  end if;

  return new;
exception when others then
  -- أي خطأ هنا يجب ألا يُفشل تسجيل بصمة الحضور
  return new;
end $function$
;

-- notify_news()
CREATE OR REPLACE FUNCTION public.notify_news()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.is_published is not true then return new; end if;
  if tg_op = 'UPDATE' and old.is_published is true then return new; end if;

  perform send_notification(
    'خبر جديد: ' || new.title,
    left(coalesce(new.excerpt, ''), 180),
    'news',
    '/news/' || coalesce(new.slug, new.id::text),
    array['teacher', 'student', 'guardian', 'admin'],
    null, null, null, true
  );

  return new;
end $function$
;

-- notify_official_absence()
CREATE OR REPLACE FUNCTION public.notify_official_absence()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_period  int;
  v_cnt     int;
  v_student record;
  v_ids     uuid[];
  v_nid     uuid;
  v_body    text;
begin
  -- الغياب فقط، وعند التسجيل أو التحويل إليه (نفس منطق notify_absence)
  if new.status <> 'absent' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'absent' then return new; end if;

  -- رقم حصة هذا السجل — يهمّنا فقط الحصتان 1 و 2
  select sc.period_no into v_period
  from schedule sc where sc.id = new.schedule_id;
  if v_period is null or v_period not in (1, 2) then return new; end if;

  -- هل الطالب غائب في الحصّتين 1 و 2 معًا اليوم؟
  select count(distinct sc.period_no) into v_cnt
  from class_attendance ca
  join schedule sc on sc.id = ca.schedule_id
  where ca.student_id = new.student_id
    and ca.attend_date = new.attend_date
    and ca.status = 'absent'
    and sc.period_no in (1, 2);
  if v_cnt < 2 then return new; end if;   -- لم تكتمل الحصتان بعد

  -- منع التكرار: أول مرة فقط تُنشئ الدفع
  insert into official_absence_notified(student_id, attend_date)
    values (new.student_id, new.attend_date)
    on conflict do nothing;
  if not found then return new; end if;   -- سبق التنبيه اليوم

  select s.full_name, s.user_id into v_student
  from students s where s.id = new.student_id;
  if v_student is null then return new; end if;

  v_body := coalesce(v_student.full_name, 'الطالب')
            || ' — غياب رسمي عن الحصّتين الأولى والثانية بتاريخ '
            || to_char(new.attend_date, 'DD/MM/YYYY');

  -- الطالب + أولياء أمره
  select array_remove(array_agg(uid), null) into v_ids
  from (
    select v_student.user_id as uid
    union
    select g.user_id
    from guardian_student gs
    join guardians g on g.id = gs.guardian_id
    where gs.student_id = new.student_id
  ) t;

  if v_ids is not null and array_length(v_ids, 1) > 0 then
    v_nid := send_notification(
      'غياب رسمي', v_body, 'alert', '/',
      null, v_ids, null, null, true
    );
    perform push_notification(v_nid);
  end if;

  return new;
exception when others then
  -- أي خطأ هنا يجب ألا يُفشل تسجيل الحضور
  return new;
end $function$
;

-- notify_permission()
CREATE OR REPLACE FUNCTION public.notify_permission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_req    record;
  v_name   text;
  v_body   text;
  v_ids    uuid[];
begin
  select request_date, scope, period_numbers, note
  into v_req
  from permission_requests where id = new.request_id;

  if v_req is null then return new; end if;

  select full_name into v_name from students where id = new.student_id;

  v_body := coalesce(v_name, 'الطالب') || ' — '
    || case when v_req.scope = 'day' then 'اليوم كاملًا'
            else 'الحصص ' || array_to_string(v_req.period_numbers, '، ') end
    || ' بتاريخ ' || to_char(v_req.request_date, 'DD/MM/YYYY')
    || coalesce(' · ' || v_req.note, '');

  select array_remove(array_agg(uid), null) into v_ids
  from (
    select s.user_id as uid from students s where s.id = new.student_id
    union
    select g.user_id
    from guardian_student gs
    join guardians g on g.id = gs.guardian_id
    where gs.student_id = new.student_id
  ) t;

  if v_ids is not null and array_length(v_ids, 1) > 0 then
    perform send_notification(
      'استئذان داخلي', v_body, 'permission', '/',
      null, v_ids, null, null, true
    );
  end if;

  return new;
end $function$
;

-- notify_ticket_support(p_feedback_id uuid, p_title text, p_body
CREATE OR REPLACE FUNCTION public.notify_ticket_support(p_feedback_id uuid, p_title text, p_body text, p_link text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_ids uuid[];
begin
  select array_agg(distinct ar.user_id) into v_user_ids
  from admin_roles ar
  where ar.role_type = 'tech_support'
     or ar.role_type in (select role_type from role_permissions where permission = 'feedback');

  if v_user_ids is null or array_length(v_user_ids, 1) is null then
    return;
  end if;

  perform send_notification(
    p_title    => p_title,
    p_body     => p_body,
    p_kind     => 'alert',
    p_link     => p_link,
    p_roles    => null,
    p_user_ids => v_user_ids,
    p_grade    => null,
    p_class_no => null,
    p_is_auto  => true
  );
end;
$function$
;

-- official_daily_status(p_date date)
CREATE OR REPLACE FUNCTION public.official_daily_status(p_date date)
 RETURNS TABLE(student_id uuid, full_name text, class_no integer, grade integer, p1_status text, p2_status text, official text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with base as (
    select
      v.student_id,
      v.full_name,
      v.class_no,
      v.grade,
      max(case when sc.period_no = 1 then ca.status end) as p1_status,
      max(case when sc.period_no = 2 then ca.status end) as p2_status
    from v_active_students v
    left join class_attendance ca
      on ca.student_id = v.student_id
     and ca.attend_date = p_date
    left join schedule sc
      on sc.id = ca.schedule_id
     and sc.period_no in (1, 2)
    group by v.student_id, v.full_name, v.class_no, v.grade
  )
  select
    student_id, full_name, class_no, grade, p1_status, p2_status,
    case
      when p1_status is null or p2_status is null then 'pending'
      when p1_status = 'absent' and p2_status = 'absent' then 'absent'
      else 'present'
    end as official
  from base;
$function$
;

-- official_status_by_day(p_from date, p_to date)
CREATE OR REPLACE FUNCTION public.official_status_by_day(p_from date, p_to date)
 RETURNS TABLE(attend_date date, present bigint, absent bigint, pending bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as d
  ),
  base as (
    select
      d.d as attend_date,
      v.student_id,
      max(case when sc.period_no = 1 then ca.status end) as p1,
      max(case when sc.period_no = 2 then ca.status end) as p2
    from days d
    cross join v_active_students v
    left join class_attendance ca
      on ca.student_id = v.student_id and ca.attend_date = d.d
    left join schedule sc
      on sc.id = ca.schedule_id and sc.period_no in (1, 2)
    group by d.d, v.student_id
  ),
  classified as (
    select
      attend_date,
      case
        when p1 is null and p2 is null then 'none'
        when p1 is null or p2 is null then 'pending'
        when p1 = 'absent' and p2 = 'absent' then 'absent'
        else 'present'
      end as status
    from base
  )
  select
    attend_date,
    count(*) filter (where status = 'present') as present,
    count(*) filter (where status = 'absent')  as absent,
    count(*) filter (where status = 'pending') as pending
  from classified
  where status <> 'none'
  group by attend_date
  order by attend_date;
$function$
;

-- owns_schedule(p_schedule uuid)
CREATE OR REPLACE FUNCTION public.owns_schedule(p_schedule uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.schedule
    where id = p_schedule
      and teacher_id = public.current_teacher_id()
  );
$function$
;

-- publish_online_quiz(p_quiz uuid, p_students uuid[], p_opens tim
CREATE OR REPLACE FUNCTION public.publish_online_quiz(p_quiz uuid, p_students uuid[], p_opens timestamp with time zone, p_closes timestamp with time zone, p_duration integer, p_show_result boolean, p_renotify boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  qz      public.quizzes%rowtype;
  v_new   uuid[];
  v_users uuid[];
  v_nid   uuid;
  v_body  text;
  v_first boolean;
begin
  select * into qz from quizzes where id = p_quiz;
  if qz.id is null or qz.teacher_id <> auth.uid() then
    raise exception 'غير مصرّح: الاختبار ليس لك';
  end if;
  if not exists (select 1 from quiz_questions where quiz_id = p_quiz) then
    raise exception 'لا توجد أسئلة في الاختبار';
  end if;
  if p_closes <= p_opens then raise exception 'موعد الإغلاق يجب أن يكون بعد موعد الفتح'; end if;
  if p_closes <= now() then raise exception 'موعد الإغلاق مضى'; end if;

  v_first := not exists (select 1 from quiz_online where quiz_id = p_quiz);

  insert into quiz_online (quiz_id, opens_at, closes_at, duration_min, show_result)
  values (p_quiz, p_opens, p_closes, greatest(1, coalesce(p_duration, 15)), coalesce(p_show_result, true))
  on conflict (quiz_id) do update
     set opens_at = excluded.opens_at, closes_at = excluded.closes_at,
         duration_min = excluded.duration_min, show_result = excluded.show_result;

  -- إزالة من لم يبدأ ولم يعد ضمن القائمة
  delete from quiz_assignments
   where quiz_id = p_quiz and started_at is null
     and not (student_id = any(coalesce(p_students, '{}')));

  -- إضافة الجدد — بشرط أن يكونوا طلابًا نشطين في فصل مُسند إليه الاختبار
  with ins as (
    insert into quiz_assignments (quiz_id, student_id, class_id)
    select distinct on (e.student_id) p_quiz, e.student_id, e.class_id
      from student_enrollment e
      join quiz_classes qc on qc.class_id = e.class_id and qc.quiz_id = p_quiz
     where e.status = 'active' and e.student_id = any(coalesce(p_students, '{}'))
    on conflict (quiz_id, student_id) do nothing
    returning student_id
  )
  select array_agg(student_id) into v_new from ins;

  if qz.status = 'draft' then update quizzes set status = 'ready' where id = p_quiz; end if;

  -- من يُشعَر
  select array_agg(distinct s.user_id) into v_users
    from quiz_assignments a join students s on s.id = a.student_id
   where a.quiz_id = p_quiz and s.user_id is not null and a.submitted_at is null
     and (a.student_id = any(coalesce(v_new, '{}')) or p_renotify);

  if v_users is null or array_length(v_users, 1) is null then return 0; end if;

  v_body := coalesce(qz.subject_name || ' — ', '') ||
            'متاح من ' || to_char(p_opens at time zone 'Asia/Riyadh', 'YYYY/MM/DD HH12:MI') ||
            case when to_char(p_opens at time zone 'Asia/Riyadh', 'AM') = 'AM' then ' ص' else ' م' end ||
            ' حتى ' || to_char(p_closes at time zone 'Asia/Riyadh', 'YYYY/MM/DD HH12:MI') ||
            case when to_char(p_closes at time zone 'Asia/Riyadh', 'AM') = 'AM' then ' ص' else ' م' end ||
            '، والمدة ' || greatest(1, coalesce(p_duration, 15)) || ' دقيقة تبدأ من لحظة دخولك. ' ||
            'افتح الرابط وابدأ حين تكون مستعدًا، ويُسلَّم تلقائيًا عند انتهاء الوقت.';

  v_nid := public.send_notification(
    p_title    := case when v_first or not p_renotify then 'اختبار إلكتروني: ' else 'تذكير — اختبار إلكتروني: ' end || qz.title,
    p_body     := v_body,
    p_kind     := 'quiz',
    p_link     := '/quiz/' || p_quiz,
    p_user_ids := v_users,
    p_is_auto  := true);

  if v_nid is not null then
    begin
      update notifications
         set sender_name = coalesce((select full_name from users where id = auth.uid()), sender_name)
       where id = v_nid;
    exception when others then null;
    end;
    perform public.push_notification(v_nid);
    update quiz_assignments a set notified_at = now()
      from students s
     where a.quiz_id = p_quiz and s.id = a.student_id and s.user_id = any(v_users);
  end if;

  return array_length(v_users, 1);
end $function$
;

-- push_notification(p_nid uuid)
CREATE OR REPLACE FUNCTION public.push_notification(p_nid uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_nid is null then return; end if;
  perform net.http_post(
    url     := 'https://makkahsec.com/.netlify/functions/push-send',
    body    := jsonb_build_object('notification_id', p_nid),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
exception when others then
  -- فشل الدفع لا يُعطّل أي شيء
  return;
end $function$
;

-- quiz_period_summary(p_class uuid, p_subject uuid, p_period text
CREATE OR REPLACE FUNCTION public.quiz_period_summary(p_class uuid, p_subject uuid, p_period text)
 RETURNS TABLE(student_id uuid, student_name text, quizzes_count integer, total_score numeric, total_max numeric, percent numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  select s.id,
         s.full_name,
         count(sub.id)::int,
         round(coalesce(sum(sub.score), 0), 2),
         round(coalesce(sum(q.total_marks) filter (where sub.id is not null), 0), 2),
         case when coalesce(sum(q.total_marks) filter (where sub.id is not null), 0) > 0
              then round(100.0 * coalesce(sum(sub.score), 0)
                         / sum(q.total_marks) filter (where sub.id is not null), 1)
              else 0 end
    from public.students s
    join public.student_enrollment e
      on e.student_id = s.id and e.class_id = p_class and e.status = 'active'
    left join public.quiz_submissions sub on sub.student_id = s.id and sub.absent = false
    left join public.quizzes q
      on q.id = sub.quiz_id and q.period = p_period
     and (p_subject is null or q.subject_id = p_subject)
   where sub.id is null or q.id is not null
   group by s.id, s.full_name
   order by s.full_name;
$function$
;

-- quiz_save_manual_score(p_quiz uuid, p_class uuid, p_student uui
CREATE OR REPLACE FUNCTION public.quiz_save_manual_score(p_quiz uuid, p_class uuid, p_student uuid, p_score numeric, p_absent boolean DEFAULT false)
 RETURNS quiz_submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_quiz  public.quizzes;
  v_score numeric;
  v_row   public.quiz_submissions;
begin
  select * into v_quiz from public.quizzes where id = p_quiz;
  if v_quiz.id is null or v_quiz.teacher_id <> auth.uid() then
    raise exception 'غير مصرّح: الرصد لمعلم الاختبار';
  end if;

  if coalesce(p_absent, false) then
    v_score := null;
  else
    if p_score is null then raise exception 'اكتب درجة الطالب'; end if;
    v_score := greatest(0, least(p_score, coalesce(v_quiz.total_marks, p_score)));
  end if;

  insert into public.quiz_submissions as qs
    (quiz_id, class_id, student_id, answers, absent, score, marked_by)
  values (p_quiz, p_class, p_student, '{}'::jsonb, coalesce(p_absent, false), v_score, auth.uid())
  on conflict (quiz_id, student_id) do update set
    class_id = excluded.class_id, absent = excluded.absent,
    score = excluded.score, marked_by = excluded.marked_by
  returning * into v_row;

  if v_quiz.status = 'ready' then
    update public.quizzes set status = 'marking' where id = p_quiz;
  end if;

  return v_row;
end;
$function$
;

-- refresh_online_quiz(p_quiz uuid)
CREATE OR REPLACE FUNCTION public.refresh_online_quiz(p_quiz uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not exists (select 1 from quizzes where id = p_quiz and teacher_id = auth.uid()) then
    raise exception 'غير مصرّح';
  end if;
  perform public._sweep_online_quiz(p_quiz);
end $function$
;

-- sa_can_excuse()
CREATE OR REPLACE FUNCTION public.sa_can_excuse()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and ar.role_type in ('principal', 'tech_support', 'deputy_students', 'clerk', 'clerk_2')
  );
$function$
;

-- sa_can_manage()
CREATE OR REPLACE FUNCTION public.sa_can_manage()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and (
        ar.role_type in ('principal', 'tech_support', 'deputy_students')
        or exists (
          select 1 from public.role_permissions rp
          where rp.role_type = ar.role_type and rp.permission = 'reports'
        )
      )
  );
$function$
;

-- sa_is_staff()
CREATE OR REPLACE FUNCTION public.sa_is_staff()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin' and coalesce(u.is_active, true)
  );
$function$
;

-- sa_my_name()
CREATE OR REPLACE FUNCTION public.sa_my_name()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(full_name, username) from public.users where id = auth.uid();
$function$
;

-- sa_override_mark(p_date date, p_student jsonb, p_status text, p
CREATE OR REPLACE FUNCTION public.sa_override_mark(p_date date, p_student jsonb, p_status text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prev text;
begin
  if p_status not in ('present', 'absent', 'excused') then
    raise exception 'حالة غير صالحة: %', p_status;
  end if;
  if not exists (select 1 from public.official_attendance_days where attend_date = p_date) then
    raise exception 'هذا اليوم لم يُعتمد بعد';
  end if;

  select status into v_prev from public.official_day_marks
  where attend_date = p_date and student_id = (p_student->>'student_id')::uuid;

  -- العذر: منحه أو سحبه
  if p_status = 'excused' or v_prev = 'excused' then
    if not public.sa_can_excuse() then
      raise exception 'غير مصرّح: تعديل الغياب بعذر لوكيل شؤون الطلاب والمساعد الإداري 1 و 2';
    end if;
  elsif not (public.sa_can_manage() or public.sa_can_excuse()) then
    raise exception 'غير مصرّح: تعديل الغياب الرسمي لوكيل شؤون الطلاب والإدارة';
  end if;

  insert into public.official_day_marks as m (
    attend_date, student_id, status, punched, full_name, national_id, class_no, grade,
    manual, note, edited_by_name, edited_at)
  values (
    p_date, (p_student->>'student_id')::uuid, p_status,
    coalesce((p_student->>'punched')::boolean, false),
    p_student->>'full_name', p_student->>'national_id',
    nullif(p_student->>'class_no', '')::int, nullif(p_student->>'grade', '')::int,
    true, p_note, public.sa_my_name(), now())
  on conflict (attend_date, student_id) do update set
    status = excluded.status, manual = true, note = excluded.note,
    edited_by_name = excluded.edited_by_name, edited_at = excluded.edited_at;

  update public.official_attendance_days set
    updated_at = now(), updated_by = auth.uid(), updated_by_name = public.sa_my_name()
  where attend_date = p_date;

  perform public.sa_recount_day(p_date);
end;
$function$
;

-- sa_recount_day(p_date date)
CREATE OR REPLACE FUNCTION public.sa_recount_day(p_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d public.official_attendance_days;
  v_abs int; v_exc int; v_pen int; v_pre int;
  v_grades jsonb := '{}'::jsonb;
  g record;
begin
  select * into d from public.official_attendance_days where attend_date = p_date;
  if not found then return; end if;

  select count(*) filter (where status = 'absent'),
         count(*) filter (where status = 'excused'),
         count(*) filter (where status = 'pending')
    into v_abs, v_exc, v_pen
    from public.official_day_marks where attend_date = p_date;
  v_pre := greatest(d.total - v_abs - v_exc - v_pen, 0);

  for g in select key as grade, (value->>'total')::int as total from jsonb_each(d.by_grade) loop
    v_grades := v_grades || jsonb_build_object(g.grade, (
      select jsonb_build_object(
        'total',   g.total,
        'absent',  count(*) filter (where m.status = 'absent'),
        'excused', count(*) filter (where m.status = 'excused'),
        'pending', count(*) filter (where m.status = 'pending'),
        'present', greatest(g.total - count(*) filter (where m.status in ('absent','excused','pending')), 0))
      from public.official_day_marks m
      where m.attend_date = p_date and m.grade::text = g.grade));
  end loop;

  update public.official_attendance_days set
    absent = v_abs, excused = v_exc, pending = v_pen, present = v_pre,
    official_pct = case when d.total - v_pen > 0
                        then round(v_pre * 100.0 / (d.total - v_pen), 2) end,
    by_grade = v_grades
  where attend_date = p_date;
end;
$function$
;

-- sa_save_official_day(p_date date, p_day jsonb, p_marks jsonb, p
CREATE OR REPLACE FUNCTION public.sa_save_official_day(p_date date, p_day jsonb, p_marks jsonb, p_mode text DEFAULT 'approve'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_system boolean := coalesce(auth.role(), '') = 'service_role';
  v_name text := case when v_system then 'اعتماد آلي' else public.sa_my_name() end;
begin
  if not (v_system or public.sa_can_manage()) then
    raise exception 'غير مصرّح: اعتماد الغياب لوكيل شؤون الطلاب والإدارة';
  end if;

  if p_mode = 'final' then
    update public.official_attendance_days set
      final_present  = (p_day->>'present')::int,
      final_absent   = (p_day->>'absent')::int,
      final_excused  = (p_day->>'excused')::int,
      final_pending  = (p_day->>'pending')::int,
      final_pct      = nullif(p_day->>'pct', '')::numeric,
      final_by_grade = p_day->'by_grade',
      final_at       = now()
    where attend_date = p_date;
    if not found then
      raise exception 'اعتمد الغياب الرسمي لهذا اليوم أولًا';
    end if;
    return;
  end if;

  insert into public.official_attendance_days as d (
    attend_date, academic_year, term, total, by_grade, late_count,
    approved_at, approved_by, approved_by_name, retroactive)
  values (
    p_date, p_day->>'academic_year', nullif(p_day->>'term', '')::int,
    (p_day->>'total')::int, coalesce(p_day->'by_grade', '{}'::jsonb),
    nullif(p_day->>'late_count', '')::int,
    now(), auth.uid(), v_name, coalesce((p_day->>'retroactive')::boolean, false))
  on conflict (attend_date) do update set
    academic_year = excluded.academic_year,
    term          = excluded.term,
    total         = excluded.total,
    by_grade      = excluded.by_grade,
    late_count    = excluded.late_count,
    updated_at      = now(),
    updated_by      = auth.uid(),
    updated_by_name = v_name;

  delete from public.official_day_marks where attend_date = p_date and not manual;

  insert into public.official_day_marks (
    attend_date, student_id, status, punched, full_name, national_id, class_no, grade,
    punch_time, late_minutes)
  select p_date, (m->>'student_id')::uuid, m->>'status',
         coalesce((m->>'punched')::boolean, false),
         m->>'full_name', m->>'national_id',
         nullif(m->>'class_no', '')::int, nullif(m->>'grade', '')::int,
         nullif(m->>'punch_time', '')::timestamptz, nullif(m->>'late_minutes', '')::int
  from jsonb_array_elements(coalesce(p_marks, '[]'::jsonb)) m
  where m->>'status' in ('absent', 'excused', 'pending')
     or (m->>'status' = 'present' and coalesce(nullif(m->>'late_minutes', '')::int, 0) > 0)
  on conflict (attend_date, student_id) do update set
    punched = excluded.punched, punch_time = excluded.punch_time,
    late_minutes = excluded.late_minutes;

  perform public.sa_recount_day(p_date);
end;
$function$
;

-- save_online_draft(p_quiz uuid, p_answers jsonb)
CREATE OR REPLACE FUNCTION public.save_online_draft(p_quiz uuid, p_answers jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n int;
begin
  update quiz_assignments a set draft = coalesce(p_answers, '{}'::jsonb)
    from students s
   where a.quiz_id = p_quiz and s.id = a.student_id and s.user_id = auth.uid()
     and a.started_at is not null and a.submitted_at is null
     and now() <= a.deadline_at + interval '30 seconds';
  get diagnostics n = row_count;
  return n > 0;
end $function$
;

-- send_notification(p_title text, p_body text, p_kind text, p_lin
CREATE OR REPLACE FUNCTION public.send_notification(p_title text, p_body text DEFAULT NULL::text, p_kind text DEFAULT 'general'::text, p_link text DEFAULT NULL::text, p_roles text[] DEFAULT NULL::text[], p_user_ids uuid[] DEFAULT NULL::uuid[], p_grade integer DEFAULT NULL::integer, p_class_no integer DEFAULT NULL::integer, p_is_auto boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_count int;
begin
  -- إرسال يدوي (لا تلقائي): يُشترط أن يكون المستدعي إداريًا نشِطًا
  if not p_is_auto then
    if not exists (
      select 1 from users
      where id = auth.uid() and role::text = 'admin' and is_active = true
    ) then
      raise exception 'not authorized to send notifications';
    end if;
  end if;

  insert into notifications (title, body, kind, link, is_auto, created_by)
  values (p_title, p_body, p_kind, p_link, p_is_auto, auth.uid())
  returning id into v_id;

  if p_user_ids is not null and array_length(p_user_ids, 1) > 0 then
    insert into notification_recipients (notification_id, user_id)
    select v_id, u.id from users u
    where u.id = any(p_user_ids) and u.is_active = true
    on conflict do nothing;
  end if;

  if p_roles is not null and array_length(p_roles, 1) > 0 then
    if p_grade is null and p_class_no is null then
      insert into notification_recipients (notification_id, user_id)
      select v_id, u.id from users u
      where u.role::text = any(p_roles) and u.is_active = true
      on conflict do nothing;
    else
      if 'student' = any(p_roles) then
        insert into notification_recipients (notification_id, user_id)
        select v_id, s.user_id
        from v_active_students v
        join students s on s.id = v.student_id
        where s.user_id is not null
          and (p_grade is null or v.grade = p_grade)
          and (p_class_no is null or v.class_no = p_class_no)
        on conflict do nothing;
      end if;

      if 'guardian' = any(p_roles) then
        insert into notification_recipients (notification_id, user_id)
        select v_id, g.user_id
        from v_active_students v
        join guardian_student gs on gs.student_id = v.student_id
        join guardians g on g.id = gs.guardian_id
        where g.user_id is not null
          and (p_grade is null or v.grade = p_grade)
          and (p_class_no is null or v.class_no = p_class_no)
        on conflict do nothing;
      end if;

      if 'teacher' = any(p_roles) or 'admin' = any(p_roles) then
        insert into notification_recipients (notification_id, user_id)
        select v_id, u.id from users u
        where u.role::text = any(array_remove(array_remove(p_roles, 'student'), 'guardian'))
          and u.is_active = true
        on conflict do nothing;
      end if;
    end if;
  end if;

  select count(*) into v_count
  from notification_recipients where notification_id = v_id;

  if v_count = 0 then
    delete from notifications where id = v_id;
    return null;
  end if;

  return v_id;
end $function$
;

-- set_notification_meta(p_id uuid, p_sender_name text, p_image_ur
CREATE OR REPLACE FUNCTION public.set_notification_meta(p_id uuid, p_sender_name text, p_image_url text, p_attachment_url text, p_attachment_name text, p_youtube_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  update public.notifications
     set sender_name     = coalesce(p_sender_name,     sender_name),
         image_url        = coalesce(p_image_url,        image_url),
         attachment_url   = coalesce(p_attachment_url,   attachment_url),
         attachment_name  = coalesce(p_attachment_name,  attachment_name),
         youtube_url      = coalesce(p_youtube_url,      youtube_url)
   where id = p_id
     and created_at > now() - interval '15 minutes';
end;
$function$
;

-- start_online_quiz(p_quiz uuid)
CREATE OR REPLACE FUNCTION public.start_online_quiz(p_quiz uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.quiz_assignments%rowtype;
  o public.quiz_online%rowtype;
begin
  select a2.* into a from quiz_assignments a2 join students s on s.id = a2.student_id
   where a2.quiz_id = p_quiz and s.user_id = auth.uid() for update of a2;
  if a.id is null then raise exception 'الاختبار غير مُسند إليك'; end if;
  select * into o from quiz_online where quiz_id = p_quiz;

  if a.started_at is null then
    if now() < o.opens_at  then raise exception 'لم يُفتح الاختبار بعد'; end if;
    if now() >= o.closes_at then raise exception 'انتهى وقت الاختبار'; end if;
    update quiz_assignments
       set started_at = now(),
           deadline_at = least(now() + make_interval(mins => o.duration_min), o.closes_at)
     where id = a.id;
  end if;
  return public.get_online_quiz(p_quiz);
end $function$
;

-- student_day_timeline(p_date date, p_student_id uuid)
CREATE OR REPLACE FUNCTION public.student_day_timeline(p_date date, p_student_id uuid)
 RETURNS TABLE(punch_time timestamp with time zone, period_no integer, subject text, teacher text, status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    (select punch_time from daily_attendance
       where student_id = p_student_id and attend_date = p_date limit 1) as punch_time,
    sc.period_no,
    sub.name as subject,
    t.full_name as teacher,
    ca.status
  from class_attendance ca
  join schedule sc on sc.id = ca.schedule_id
  left join subjects sub on sub.id = sc.subject_id
  left join teachers t on t.id = sc.teacher_id
  where ca.student_id = p_student_id
    and ca.attend_date = p_date
  order by sc.period_no;
$function$
;

-- submit_online_quiz(p_quiz uuid, p_answers jsonb)
CREATE OR REPLACE FUNCTION public.submit_online_quiz(p_quiz uuid, p_answers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a public.quiz_assignments%rowtype;
begin
  select a2.* into a from quiz_assignments a2 join students s on s.id = a2.student_id
   where a2.quiz_id = p_quiz and s.user_id = auth.uid();
  if a.id is null then raise exception 'الاختبار غير مُسند إليك'; end if;
  if a.started_at is null then raise exception 'لم تبدأ الاختبار'; end if;

  if a.submitted_at is null then
    perform public._finish_online_attempt(
      a.id,
      case when now() <= a.deadline_at + interval '1 minute' then p_answers else a.draft end);
  end if;
  return public.get_online_quiz(p_quiz);
end $function$
;

-- submit_public_feedback(p_name text, p_mobile text, p_role text,
CREATE OR REPLACE FUNCTION public.submit_public_feedback(p_name text, p_mobile text, p_role text, p_category text, p_message text, p_page text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_mobile text := regexp_replace(coalesce(p_mobile, ''), '\D', '', 'g');
  v_id     public.feedback.id%type;
begin
  -- الجوال السعودي: 05XXXXXXXX أو 9665XXXXXXXX ← يُحفظ بصيغة 05XXXXXXXX
  if v_mobile ~ '^9665\d{8}$' then v_mobile := '0' || substr(v_mobile, 4); end if;
  if v_mobile !~ '^05\d{8}$' then raise exception 'رقم الجوال غير صحيح — اكتبه بصيغة 05XXXXXXXX'; end if;
  if length(trim(coalesce(p_name, ''))) < 3 then raise exception 'اكتب الاسم'; end if;
  if length(trim(coalesce(p_message, ''))) < 10 then raise exception 'اكتب وصفًا أوضح للطلب'; end if;

  -- الحد من التكرار
  if (select count(*) from public.feedback
      where contact = v_mobile and user_id is null and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'وصلنا طلبك، وسيتواصل معك الدعم الفني قريبًا — لا حاجة لتكراره';
  end if;
  if (select count(*) from public.feedback
      where user_id is null and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'الطلبات كثيرة الآن — حاول بعد قليل';
  end if;

  insert into public.feedback (name, contact, role_label, category, message, page_url, user_id)
  values (left(trim(p_name), 80), v_mobile, left(coalesce(nullif(trim(p_role), ''), 'زائر'), 30),
          case when p_category in ('login', 'bug', 'suggestion', 'data', 'other') then p_category else 'other' end,
          left(trim(p_message), 2000), left(p_page, 300), null)
  returning id into v_id;

  -- تنبيه فريق الدعم — لا يُفشل الطلب إن تعذّر
  begin
    perform public.notify_ticket_support(
      p_feedback_id => v_id,
      p_title       => 'طلب دعم من خارج البوابة',
      p_body        => left(trim(p_name) || ': ' || trim(p_message), 140),
      p_link        => '/ticket/' || v_id);
  exception when others then null;
  end;

  return v_id;
end;
$function$
;

-- substitute_check(p_schedule_id uuid, p_date date)
CREATE OR REPLACE FUNCTION public.substitute_check(p_schedule_id uuid, p_date date)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now  timestamp := now() at time zone 'Asia/Riyadh';
  v_me   public.teachers.id%type;
  v_s    record;
  v_st   time;
begin
  select t.id into v_me from teachers t where t.user_id = auth.uid();
  if v_me is null then
    raise exception 'هذه الخدمة للمعلمين فقط.' using errcode = '42501';
  end if;
  if p_date is distinct from v_now::date then
    raise exception 'حصة الانتظار تُحضَّر في يومها فقط.' using errcode = '23514';
  end if;

  select s.id, s.teacher_id, s.period_no, s.day_of_week into v_s
  from schedule s where s.id = p_schedule_id;
  if not found then
    raise exception 'الحصة غير موجودة في الجدول.' using errcode = 'P0002';
  end if;
  if v_s.teacher_id = v_me then
    raise exception 'هذه حصتك، حضّرها من شاشة التحضير.' using errcode = '23514';
  end if;
  if v_s.day_of_week is distinct from extract(dow from v_now)::int + 1 then
    raise exception 'هذه الحصة ليست في جدول اليوم.' using errcode = '23514';
  end if;

  select pt.start_time::time into v_st from period_times pt
  where pt.kind = 'period' and pt.period_no = v_s.period_no
    and pt.season = coalesce((select value from settings where key = 'active_season'), 'summer')
  limit 1;
  if v_st is not null and v_now::time < v_st + interval '10 minutes' then
    raise exception 'يُفتح الانتظار بعد ١٠ دقائق من بداية الحصة.' using errcode = '23514';
  end if;

  if exists (
    select 1 from schedule s2
    where s2.teacher_id = v_me and s2.id <> v_s.id
      and s2.day_of_week = v_s.day_of_week and s2.period_no = v_s.period_no
      and s2.academic_year::text = (select value from settings where key = 'active_year')
      and s2.term::text = coalesce((select value from settings where key = 'active_term'), '1')
  ) then
    raise exception 'لديك حصة في جدولك في الوقت نفسه، فلا يمكنك تغطية فصل آخر.'
      using errcode = '23514';
  end if;

  return v_me;
end;
$function$
;

-- substitute_roster(p_schedule_id uuid, p_date date)
CREATE OR REPLACE FUNCTION public.substitute_roster(p_schedule_id uuid, p_date date)
 RETURNS TABLE(id uuid, full_name text, is_excused boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    s.id,
    s.full_name,
    exists (
      select 1 from excused_absences ea
      where ea.student_id = s.id
        and ea.date_from <= p_date
        and ea.date_to   >= p_date
    ) as is_excused
  from schedule sc
  join student_enrollment se
    on se.class_id = sc.class_id and se.status = 'active'
  join students s
    on s.id = se.student_id
  where sc.id = p_schedule_id
  order by s.full_name;
$function$
;

-- substitute_take(p_schedule_id uuid, p_date date, p_marks jsonb)
CREATE OR REPLACE FUNCTION public.substitute_take(p_schedule_id uuid, p_date date, p_marks jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me     public.teachers.id%type := substitute_check(p_schedule_id, p_date);
  v_s      record;
  v_holder public.teachers.id%type;
  v_year   public.substitute_periods.academic_year%type;
  v_term   public.substitute_periods.term%type;
  v_st     public.class_attendance.status%type;
  v_stu    record;
  v_n      integer := 0;
begin
  select s.teacher_id, s.class_id, s.period_no, s.day_of_week into v_s
  from schedule s where s.id = p_schedule_id;

  perform pg_advisory_xact_lock(hashtext(p_schedule_id::text), hashtext(p_date::text));

  select sp.cover_teacher_id into v_holder from substitute_periods sp
  where sp.schedule_id = p_schedule_id and sp.attend_date = p_date;
  if v_holder is not null and v_holder <> v_me then
    raise exception 'سبقك معلم آخر لتحضير هذه الحصة.' using errcode = '23505';
  end if;
  if v_holder is null and exists (
    select 1 from class_attendance ca
    where ca.schedule_id = p_schedule_id and ca.attend_date = p_date
  ) then
    raise exception 'حُضِّرت هذه الحصة قبل حفظك، غالبًا حضر معلمها.' using errcode = '23505';
  end if;

  v_year := (select value from settings where key = 'active_year');
  v_term := coalesce((select value from settings where key = 'active_term'), '1');

  insert into substitute_periods (schedule_id, class_id, cover_teacher_id,
    absent_teacher_id, attend_date, period_no, day_of_week, academic_year, term)
  values (p_schedule_id, v_s.class_id, v_me, v_s.teacher_id, p_date,
    v_s.period_no, v_s.day_of_week, v_year, v_term)
  on conflict (schedule_id, attend_date) do nothing;

  for v_stu in
    select e.student_id from student_enrollment e
    where e.class_id = v_s.class_id and e.status = 'active'
  loop
    v_st := case when p_marks ->> v_stu.student_id::text
                      in ('present', 'absent', 'late', 'excused')
                 then p_marks ->> v_stu.student_id::text else 'present' end;
    insert into class_attendance (student_id, schedule_id, attend_date,
      status, recorded_by, academic_year)
    values (v_stu.student_id, p_schedule_id, p_date, v_st, auth.uid(), v_year)
    on conflict (student_id, schedule_id, attend_date)
    do update set status = excluded.status, recorded_by = excluded.recorded_by;
    v_n := v_n + 1;
  end loop;

  if v_n = 0 then
    raise exception 'لا طلاب منتظمون في هذا الفصل.' using errcode = 'P0002';
  end if;
  return v_n;
end;
$function$
;

-- sync_event_consent()
CREATE OR REPLACE FUNCTION public.sync_event_consent()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  if new.status = 'replied' and coalesce(old.status, '') <> 'replied' then
    update public.event_participants p
       set consent_at    = coalesce(new.reply_at, now()),
           guardian_id   = new.recipient_user_id,
           consent_note  = coalesce(new.data->>'consent', ''),
           consent_photo = (coalesce(new.data->>'photo_consent', '') not like 'لا أوافق%')
     where p.consent_doc_id = new.id;
  end if;
  return new;
end $function$
;

-- teacher_send_notification(p_title text, p_body text, p_class_id
CREATE OR REPLACE FUNCTION public.teacher_send_notification(p_title text, p_body text DEFAULT NULL::text, p_class_ids uuid[] DEFAULT NULL::uuid[], p_include_guardians boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_teacher_id uuid;
  v_id uuid;
  v_count int;
  v_valid_classes uuid[];
begin
  select id into v_teacher_id from teachers where user_id = auth.uid();
  if v_teacher_id is null then
    raise exception 'caller is not a teacher';
  end if;

  -- الفصول الفعلية المسندة لهذا المعلم في الفصل الدراسي الحالي
  select array_agg(distinct sc.class_id) into v_valid_classes
  from schedule sc
  join settings sy on sy.key = 'active_year'
  join settings st on st.key = 'active_term'
  where sc.teacher_id = v_teacher_id
    and sc.academic_year = sy.value
    and sc.term = st.value::int;

  if v_valid_classes is null then
    raise exception 'no assigned classes found for this teacher';
  end if;

  -- تقاطع ما طلبه المعلم مع فصوله الفعلية فقط (تجاهل أي فصل غير مسند إليه)
  if p_class_ids is not null then
    select array_agg(c) into v_valid_classes
    from unnest(v_valid_classes) c
    where c = any(p_class_ids);
  end if;

  if v_valid_classes is null or array_length(v_valid_classes, 1) = 0 then
    raise exception 'none of the requested classes are assigned to this teacher';
  end if;

  insert into notifications (title, body, kind, is_auto, created_by)
  values (p_title, p_body, 'general', false, auth.uid())
  returning id into v_id;

  -- الطلاب في الفصول المتحقَّقة
  insert into notification_recipients (notification_id, user_id)
  select v_id, s.user_id
  from student_enrollment se
  join students s on s.id = se.student_id
  where se.class_id = any(v_valid_classes)
    and se.status = 'active'
    and s.user_id is not null
  on conflict do nothing;

  -- أولياء الأمور، إن طُلب
  if p_include_guardians then
    insert into notification_recipients (notification_id, user_id)
    select v_id, g.user_id
    from student_enrollment se
    join guardian_student gs on gs.student_id = se.student_id
    join guardians g on g.id = gs.guardian_id
    where se.class_id = any(v_valid_classes)
      and se.status = 'active'
      and g.user_id is not null
    on conflict do nothing;
  end if;

  select count(*) into v_count
  from notification_recipients where notification_id = v_id;

  if v_count = 0 then
    delete from notifications where id = v_id;
    return null;
  end if;

  return v_id;
end $function$
;

-- teaches_student(p_student uuid)
CREATE OR REPLACE FUNCTION public.teaches_student(p_student uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.schedule sch
    join public.student_enrollment se
      on se.class_id      = sch.class_id
     and se.academic_year = sch.academic_year
    where sch.teacher_id    = public.current_teacher_id()
      and se.student_id     = p_student
      and se.academic_year  = public.active_year()
      and se.status         = 'active'
  );
$function$
;

-- today_ksa()
CREATE OR REPLACE FUNCTION public.today_ksa()
 RETURNS date
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select (now() at time zone 'Asia/Riyadh')::date;
$function$
;

-- touch_guides_updated_at()
CREATE OR REPLACE FUNCTION public.touch_guides_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

-- touch_news_updated_at()
CREATE OR REPLACE FUNCTION public.touch_news_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$
;

-- trim_login_log()
CREATE OR REPLACE FUNCTION public.trim_login_log()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.login_log
  where id in (
    select id
    from public.login_log
    order by created_at desc, id desc
    offset 100              -- أبقِ أحدث 100 واحذف الباقي
  );
  return null;
end;
$function$
;

-- unactivated_counts()
CREATE OR REPLACE FUNCTION public.unactivated_counts()
 RETURNS TABLE(role text, count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role::text, count(*)
  from users
  where must_change_pw = true and is_active = true
  group by role::text;
$function$
;

-- unread_count()
CREATE OR REPLACE FUNCTION public.unread_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int
  from notification_recipients
  where user_id = auth.uid() and read_at is null;
$function$
;

-- update_student_identity(p_student uuid, p_new_id text, p_new_ty
CREATE OR REPLACE FUNCTION public.update_student_identity(p_student uuid, p_new_id text, p_new_type identity_type_enum)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old text;
begin
  if not public.is_admin() then
    raise exception 'غير مصرّح';
  end if;

  select national_id into v_old from public.students where id = p_student;
  if v_old is null then
    raise exception 'الطالب غير موجود';
  end if;

  update public.students
     set previous_identity = v_old,
         national_id       = public.normalize_id(p_new_id),
         identity_type     = p_new_type
   where id = p_student;

  -- تحديث اسم المستخدم في الحساب المرتبط
  update public.users u
     set username = public.normalize_id(p_new_id)
    from public.students s
   where s.id = p_student and u.id = s.user_id;
end;
$function$
;


-- ---------------------------------------------------------------------
--  3) المفاتيح الأساسية والفريدة — 105
-- ---------------------------------------------------------------------

-- absence_warnings.absence_warnings_pkey
alter table public.absence_warnings add constraint absence_warnings_pkey PRIMARY KEY (id);

-- academic_calendar.academic_calendar_pkey
alter table public.academic_calendar add constraint academic_calendar_pkey PRIMARY KEY (id);

-- admin_missing_notes.admin_missing_notes_pkey
alter table public.admin_missing_notes add constraint admin_missing_notes_pkey PRIMARY KEY (id);

-- admin_roles.admin_roles_pkey
alter table public.admin_roles add constraint admin_roles_pkey PRIMARY KEY (id);

-- admin_roles.admin_roles_user_id_role_type_key
alter table public.admin_roles add constraint admin_roles_user_id_role_type_key UNIQUE (user_id, role_type);

-- announcement_banners.announcement_banners_pkey
alter table public.announcement_banners add constraint announcement_banners_pkey PRIMARY KEY (id);

-- announcement_dismissals.announcement_dismissals_pkey
alter table public.announcement_dismissals add constraint announcement_dismissals_pkey PRIMARY KEY (banner_id, user_id);

-- attendance_reminders.attendance_reminders_pkey
alter table public.attendance_reminders add constraint attendance_reminders_pkey PRIMARY KEY (schedule_id, remind_date);

-- behavior_notes.behavior_notes_pkey
alter table public.behavior_notes add constraint behavior_notes_pkey PRIMARY KEY (id);

-- class_attendance.class_attendance_pkey
alter table public.class_attendance add constraint class_attendance_pkey PRIMARY KEY (id);

-- class_attendance.class_attendance_student_id_schedule_id_attend
alter table public.class_attendance add constraint class_attendance_student_id_schedule_id_attend_date_key UNIQUE (student_id, schedule_id, attend_date);

-- classes.classes_class_no_academic_year_key
alter table public.classes add constraint classes_class_no_academic_year_key UNIQUE (class_no, academic_year);

-- classes.classes_pkey
alter table public.classes add constraint classes_pkey PRIMARY KEY (id);

-- daily_attendance.daily_attendance_pkey
alter table public.daily_attendance add constraint daily_attendance_pkey PRIMARY KEY (id);

-- daily_attendance.daily_attendance_student_id_attend_date_key
alter table public.daily_attendance add constraint daily_attendance_student_id_attend_date_key UNIQUE (student_id, attend_date);

-- device_mapping.device_mapping_pkey
alter table public.device_mapping add constraint device_mapping_pkey PRIMARY KEY (id);

-- devices.devices_pkey
alter table public.devices add constraint devices_pkey PRIMARY KEY (id);

-- devices.devices_serial_no_key
alter table public.devices add constraint devices_serial_no_key UNIQUE (serial_no);

-- duty_roster.duty_roster_duty_date_key
alter table public.duty_roster add constraint duty_roster_duty_date_key UNIQUE (duty_date);

-- duty_roster.duty_roster_pkey
alter table public.duty_roster add constraint duty_roster_pkey PRIMARY KEY (id);

-- event_media.event_media_pkey
alter table public.event_media add constraint event_media_pkey PRIMARY KEY (id);

-- event_participants.event_participants_event_id_student_id_key
alter table public.event_participants add constraint event_participants_event_id_student_id_key UNIQUE (event_id, student_id);

-- event_participants.event_participants_pkey
alter table public.event_participants add constraint event_participants_pkey PRIMARY KEY (id);

-- exam_slots.exam_slots_pkey
alter table public.exam_slots add constraint exam_slots_pkey PRIMARY KEY (id);

-- exam_terms.exam_terms_kind_academic_year_term_key
alter table public.exam_terms add constraint exam_terms_kind_academic_year_term_key UNIQUE (kind, academic_year, term);

-- exam_terms.exam_terms_pkey
alter table public.exam_terms add constraint exam_terms_pkey PRIMARY KEY (id);

-- excused_absences.excused_absences_pkey
alter table public.excused_absences add constraint excused_absences_pkey PRIMARY KEY (id);

-- feedback.feedback_pkey
alter table public.feedback add constraint feedback_pkey PRIMARY KEY (id);

-- feedback_replies.feedback_replies_pkey
alter table public.feedback_replies add constraint feedback_replies_pkey PRIMARY KEY (id);

-- form_counters.form_counters_pkey
alter table public.form_counters add constraint form_counters_pkey PRIMARY KEY (year, category);

-- form_documents.form_documents_pkey
alter table public.form_documents add constraint form_documents_pkey PRIMARY KEY (id);

-- form_documents.form_documents_serial_key
alter table public.form_documents add constraint form_documents_serial_key UNIQUE (serial);

-- form_templates.form_templates_key_key
alter table public.form_templates add constraint form_templates_key_key UNIQUE (key);

-- form_templates.form_templates_pkey
alter table public.form_templates add constraint form_templates_pkey PRIMARY KEY (id);

-- grade_entries.grade_entries_pkey
alter table public.grade_entries add constraint grade_entries_pkey PRIMARY KEY (id);

-- grade_entries.grade_entries_teacher_user_id_class_id_subject_ke
alter table public.grade_entries add constraint grade_entries_teacher_user_id_class_id_subject_key_academic_key UNIQUE (teacher_user_id, class_id, subject_key, academic_year, term, student_id, cell);

-- grades_records.grades_records_pkey
alter table public.grades_records add constraint grades_records_pkey PRIMARY KEY (id);

-- guardian_student.guardian_student_guardian_id_student_id_key
alter table public.guardian_student add constraint guardian_student_guardian_id_student_id_key UNIQUE (guardian_id, student_id);

-- guardian_student.guardian_student_pkey
alter table public.guardian_student add constraint guardian_student_pkey PRIMARY KEY (id);

-- guardians.guardians_pkey
alter table public.guardians add constraint guardians_pkey PRIMARY KEY (id);

-- guardians.guardians_user_id_key
alter table public.guardians add constraint guardians_user_id_key UNIQUE (user_id);

-- guides.guides_pkey
alter table public.guides add constraint guides_pkey PRIMARY KEY (id);

-- import_logs.import_logs_pkey
alter table public.import_logs add constraint import_logs_pkey PRIMARY KEY (id);

-- login_log.login_log_pkey
alter table public.login_log add constraint login_log_pkey PRIMARY KEY (id);

-- maintenance_state.maintenance_state_pkey
alter table public.maintenance_state add constraint maintenance_state_pkey PRIMARY KEY (id);

-- news.news_pkey
alter table public.news add constraint news_pkey PRIMARY KEY (id);

-- news.news_slug_key
alter table public.news add constraint news_slug_key UNIQUE (slug);

-- notification_drafts.notification_drafts_pkey
alter table public.notification_drafts add constraint notification_drafts_pkey PRIMARY KEY (id);

-- notification_recipients.notification_recipients_pkey
alter table public.notification_recipients add constraint notification_recipients_pkey PRIMARY KEY (notification_id, user_id);

-- notifications.notifications_pkey
alter table public.notifications add constraint notifications_pkey PRIMARY KEY (id);

-- official_absence_notified.official_absence_notified_pkey
alter table public.official_absence_notified add constraint official_absence_notified_pkey PRIMARY KEY (student_id, attend_date);

-- official_attendance_days.official_attendance_days_pkey
alter table public.official_attendance_days add constraint official_attendance_days_pkey PRIMARY KEY (attend_date);

-- official_day_marks.official_day_marks_pkey
alter table public.official_day_marks add constraint official_day_marks_pkey PRIMARY KEY (attend_date, student_id);

-- period_times.period_times_pkey
alter table public.period_times add constraint period_times_pkey PRIMARY KEY (id);

-- permission_grantors.permission_grantors_pkey
alter table public.permission_grantors add constraint permission_grantors_pkey PRIMARY KEY (user_id);

-- permission_request_students.permission_request_students_pkey
alter table public.permission_request_students add constraint permission_request_students_pkey PRIMARY KEY (request_id, student_id);

-- permission_requests.permission_requests_pkey
alter table public.permission_requests add constraint permission_requests_pkey PRIMARY KEY (id);

-- permission_returns.permission_returns_pkey
alter table public.permission_returns add constraint permission_returns_pkey PRIMARY KEY (id);

-- permission_returns.permission_returns_student_id_return_date_ke
alter table public.permission_returns add constraint permission_returns_student_id_return_date_key UNIQUE (student_id, return_date);

-- push_subscriptions.push_subscriptions_endpoint_key
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_key UNIQUE (endpoint);

-- push_subscriptions.push_subscriptions_pkey
alter table public.push_subscriptions add constraint push_subscriptions_pkey PRIMARY KEY (id);

-- quiz_assignments.quiz_assignments_pkey
alter table public.quiz_assignments add constraint quiz_assignments_pkey PRIMARY KEY (id);

-- quiz_assignments.quiz_assignments_quiz_id_student_id_key
alter table public.quiz_assignments add constraint quiz_assignments_quiz_id_student_id_key UNIQUE (quiz_id, student_id);

-- quiz_classes.quiz_classes_pkey
alter table public.quiz_classes add constraint quiz_classes_pkey PRIMARY KEY (id);

-- quiz_classes.quiz_classes_quiz_id_class_id_key
alter table public.quiz_classes add constraint quiz_classes_quiz_id_class_id_key UNIQUE (quiz_id, class_id);

-- quiz_online.quiz_online_pkey
alter table public.quiz_online add constraint quiz_online_pkey PRIMARY KEY (quiz_id);

-- quiz_questions.quiz_questions_pkey
alter table public.quiz_questions add constraint quiz_questions_pkey PRIMARY KEY (id);

-- quiz_submissions.quiz_submissions_pkey
alter table public.quiz_submissions add constraint quiz_submissions_pkey PRIMARY KEY (id);

-- quiz_submissions.quiz_submissions_quiz_id_student_id_key
alter table public.quiz_submissions add constraint quiz_submissions_quiz_id_student_id_key UNIQUE (quiz_id, student_id);

-- quizzes.quizzes_pkey
alter table public.quizzes add constraint quizzes_pkey PRIMARY KEY (id);

-- role_permissions.role_permissions_pkey
alter table public.role_permissions add constraint role_permissions_pkey PRIMARY KEY (role_type, permission);

-- schedule.schedule_pkey
alter table public.schedule add constraint schedule_pkey PRIMARY KEY (id);

-- school_assets.school_assets_pkey
alter table public.school_assets add constraint school_assets_pkey PRIMARY KEY (key);

-- school_events.school_events_pkey
alter table public.school_events add constraint school_events_pkey PRIMARY KEY (id);

-- school_events.school_events_serial_key
alter table public.school_events add constraint school_events_serial_key UNIQUE (serial);

-- settings.settings_pkey
alter table public.settings add constraint settings_pkey PRIMARY KEY (key);

-- site_status_snapshots.site_status_snapshots_pkey
alter table public.site_status_snapshots add constraint site_status_snapshots_pkey PRIMARY KEY (day);

-- sms_logs.sms_logs_pkey
alter table public.sms_logs add constraint sms_logs_pkey PRIMARY KEY (id);

-- student_enrollment.student_enrollment_pkey
alter table public.student_enrollment add constraint student_enrollment_pkey PRIMARY KEY (id);

-- student_enrollment.student_enrollment_student_id_academic_year_
alter table public.student_enrollment add constraint student_enrollment_student_id_academic_year_key UNIQUE (student_id, academic_year);

-- student_referrals.student_referrals_pkey
alter table public.student_referrals add constraint student_referrals_pkey PRIMARY KEY (id);

-- student_referrals.student_referrals_serial_key
alter table public.student_referrals add constraint student_referrals_serial_key UNIQUE (serial);

-- student_results.student_results_pkey
alter table public.student_results add constraint student_results_pkey PRIMARY KEY (id);

-- student_results.student_results_student_id_report_type_academic
alter table public.student_results add constraint student_results_student_id_report_type_academic_year_key UNIQUE (student_id, report_type, academic_year);

-- students.students_national_id_key
alter table public.students add constraint students_national_id_key UNIQUE (national_id);

-- students.students_pkey
alter table public.students add constraint students_pkey PRIMARY KEY (id);

-- students.students_user_id_key
alter table public.students add constraint students_user_id_key UNIQUE (user_id);

-- subject_aliases.subject_aliases_external_name_grade_key
alter table public.subject_aliases add constraint subject_aliases_external_name_grade_key UNIQUE (external_name, grade);

-- subject_aliases.subject_aliases_pkey
alter table public.subject_aliases add constraint subject_aliases_pkey PRIMARY KEY (id);

-- subjects.subjects_pkey
alter table public.subjects add constraint subjects_pkey PRIMARY KEY (id);

-- substitute_periods.substitute_periods_pkey
alter table public.substitute_periods add constraint substitute_periods_pkey PRIMARY KEY (id);

-- substitute_periods.substitute_periods_schedule_id_attend_date_k
alter table public.substitute_periods add constraint substitute_periods_schedule_id_attend_date_key UNIQUE (schedule_id, attend_date);

-- supervision_duty.supervision_duty_day_of_week_person_name_kind_
alter table public.supervision_duty add constraint supervision_duty_day_of_week_person_name_kind_key UNIQUE (day_of_week, person_name, kind);

-- supervision_duty.supervision_duty_pkey
alter table public.supervision_duty add constraint supervision_duty_pkey PRIMARY KEY (id);

-- teacher_follow_up.teacher_follow_up_pkey
alter table public.teacher_follow_up add constraint teacher_follow_up_pkey PRIMARY KEY (id);

-- teacher_follow_up.teacher_follow_up_teacher_id_class_id_subject
alter table public.teacher_follow_up add constraint teacher_follow_up_teacher_id_class_id_subject_academic_year_key UNIQUE (teacher_id, class_id, subject, academic_year, term, period, student_id, item_key, slot_no);

-- teacher_granted_tabs.teacher_granted_tabs_pkey
alter table public.teacher_granted_tabs add constraint teacher_granted_tabs_pkey PRIMARY KEY (teacher_id, tab_key);

-- teacher_hidden_tabs.teacher_hidden_tabs_pkey
alter table public.teacher_hidden_tabs add constraint teacher_hidden_tabs_pkey PRIMARY KEY (teacher_id, tab_key);

-- teachers.teachers_national_id_key
alter table public.teachers add constraint teachers_national_id_key UNIQUE (national_id);

-- teachers.teachers_pkey
alter table public.teachers add constraint teachers_pkey PRIMARY KEY (id);

-- teachers.teachers_user_id_key
alter table public.teachers add constraint teachers_user_id_key UNIQUE (user_id);

-- unmatched_logs.unmatched_logs_pkey
alter table public.unmatched_logs add constraint unmatched_logs_pkey PRIMARY KEY (id);

-- user_signatures.user_signatures_pkey
alter table public.user_signatures add constraint user_signatures_pkey PRIMARY KEY (user_id);

-- users.users_pkey
alter table public.users add constraint users_pkey PRIMARY KEY (id);

-- users.users_username_key
alter table public.users add constraint users_username_key UNIQUE (username);


-- ---------------------------------------------------------------------
--  4) المفاتيح الخارجية وقيود التحقق — 157
-- ---------------------------------------------------------------------

-- absence_warnings.absence_warnings_source_check
alter table public.absence_warnings add constraint absence_warnings_source_check CHECK ((source = ANY (ARRAY['system'::text, 'paper'::text])));

-- absence_warnings.absence_warnings_stage_check
alter table public.absence_warnings add constraint absence_warnings_stage_check CHECK ((stage = ANY (ARRAY['warn1'::text, 'warn2'::text, 'transfer'::text])));

-- absence_warnings.absence_warnings_student_id_fkey
alter table public.absence_warnings add constraint absence_warnings_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- academic_calendar.academic_calendar_kind_check
alter table public.academic_calendar add constraint academic_calendar_kind_check CHECK ((kind = ANY (ARRAY['event'::text, 'holiday'::text, 'exam'::text, 'term_start'::text, 'term_end'::text])));

-- admin_missing_notes.admin_missing_notes_action_check
alter table public.admin_missing_notes add constraint admin_missing_notes_action_check CHECK ((action = ANY (ARRAY['escaped'::text, 'parent_permission'::text, 'no_entry'::text])));

-- admin_missing_notes.admin_missing_notes_created_by_fkey
alter table public.admin_missing_notes add constraint admin_missing_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

-- admin_missing_notes.admin_missing_notes_student_id_fkey
alter table public.admin_missing_notes add constraint admin_missing_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- admin_roles.admin_roles_user_id_fkey
alter table public.admin_roles add constraint admin_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- announcement_banners.announcement_banners_check
alter table public.announcement_banners add constraint announcement_banners_check CHECK ((ends_at > starts_at));

-- announcement_banners.announcement_banners_color_check
alter table public.announcement_banners add constraint announcement_banners_color_check CHECK ((color = ANY (ARRAY['mint'::text, 'blue'::text, 'amber'::text, 'red'::text, 'gray'::text])));

-- announcement_banners.announcement_banners_created_by_fkey
alter table public.announcement_banners add constraint announcement_banners_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

-- announcement_dismissals.announcement_dismissals_banner_id_fkey
alter table public.announcement_dismissals add constraint announcement_dismissals_banner_id_fkey FOREIGN KEY (banner_id) REFERENCES announcement_banners(id) ON DELETE CASCADE;

-- announcement_dismissals.announcement_dismissals_user_id_fkey
alter table public.announcement_dismissals add constraint announcement_dismissals_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- behavior_notes.behavior_notes_reviewed_by_fkey
alter table public.behavior_notes add constraint behavior_notes_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

-- behavior_notes.behavior_notes_student_id_fkey
alter table public.behavior_notes add constraint behavior_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- behavior_notes.behavior_notes_teacher_id_fkey
alter table public.behavior_notes add constraint behavior_notes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

-- class_attendance.class_attendance_recorded_by_fkey
alter table public.class_attendance add constraint class_attendance_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;

-- class_attendance.class_attendance_schedule_id_fkey
alter table public.class_attendance add constraint class_attendance_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedule(id) ON DELETE CASCADE;

-- class_attendance.class_attendance_student_id_fkey
alter table public.class_attendance add constraint class_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- class_attendance.class_attendance_updated_by_fkey
alter table public.class_attendance add constraint class_attendance_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- classes.classes_class_no_check
alter table public.classes add constraint classes_class_no_check CHECK (((class_no >= 101) AND (class_no <= 399)));

-- classes.classes_grade_check
alter table public.classes add constraint classes_grade_check CHECK ((grade = ANY (ARRAY[1, 2, 3])));

-- daily_attendance.daily_attendance_student_id_fkey
alter table public.daily_attendance add constraint daily_attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- device_mapping.device_mapping_student_id_fkey
alter table public.device_mapping add constraint device_mapping_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- duty_roster.duty_roster_user_a_fkey
alter table public.duty_roster add constraint duty_roster_user_a_fkey FOREIGN KEY (user_a) REFERENCES users(id) ON DELETE SET NULL;

-- duty_roster.duty_roster_user_b_fkey
alter table public.duty_roster add constraint duty_roster_user_b_fkey FOREIGN KEY (user_b) REFERENCES users(id) ON DELETE SET NULL;

-- event_media.event_media_event_id_fkey
alter table public.event_media add constraint event_media_event_id_fkey FOREIGN KEY (event_id) REFERENCES school_events(id) ON DELETE CASCADE;

-- event_participants.event_participants_consent_by_fkey
alter table public.event_participants add constraint event_participants_consent_by_fkey FOREIGN KEY (consent_by) REFERENCES users(id) ON DELETE SET NULL;

-- event_participants.event_participants_consent_doc_id_fkey
alter table public.event_participants add constraint event_participants_consent_doc_id_fkey FOREIGN KEY (consent_doc_id) REFERENCES form_documents(id) ON DELETE SET NULL;

-- event_participants.event_participants_event_id_fkey
alter table public.event_participants add constraint event_participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES school_events(id) ON DELETE CASCADE;

-- event_participants.event_participants_guardian_id_fkey
alter table public.event_participants add constraint event_participants_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES users(id) ON DELETE SET NULL;

-- event_participants.event_participants_student_id_fkey
alter table public.event_participants add constraint event_participants_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- exam_slots.exam_slots_class_id_fkey
alter table public.exam_slots add constraint exam_slots_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- exam_slots.exam_slots_exam_term_id_fkey
alter table public.exam_slots add constraint exam_slots_exam_term_id_fkey FOREIGN KEY (exam_term_id) REFERENCES exam_terms(id) ON DELETE CASCADE;

-- exam_slots.exam_slots_schedule_id_fkey
alter table public.exam_slots add constraint exam_slots_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedule(id) ON DELETE SET NULL;

-- exam_slots.exam_slots_subject_id_fkey
alter table public.exam_slots add constraint exam_slots_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;

-- exam_terms.exam_terms_kind_check
alter table public.exam_terms add constraint exam_terms_kind_check CHECK ((kind = ANY (ARRAY['period1'::text, 'period2'::text, 'final'::text])));

-- excused_absences.excused_absences_check
alter table public.excused_absences add constraint excused_absences_check CHECK ((date_to >= date_from));

-- excused_absences.excused_absences_created_by_fkey
alter table public.excused_absences add constraint excused_absences_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- excused_absences.excused_absences_student_id_fkey
alter table public.excused_absences add constraint excused_absences_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- feedback.feedback_category_check
alter table public.feedback add constraint feedback_category_check CHECK ((category = ANY (ARRAY['login'::text, 'bug'::text, 'suggestion'::text, 'data'::text, 'other'::text]))) NOT VALID;

-- feedback.feedback_status_check
alter table public.feedback add constraint feedback_status_check CHECK ((status = ANY (ARRAY['new'::text, 'in_progress'::text, 'done'::text])));

-- feedback.feedback_user_id_fkey
alter table public.feedback add constraint feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);

-- feedback_replies.feedback_replies_feedback_id_fkey
alter table public.feedback_replies add constraint feedback_replies_feedback_id_fkey FOREIGN KEY (feedback_id) REFERENCES feedback(id) ON DELETE CASCADE;

-- feedback_replies.feedback_replies_sender_id_fkey
alter table public.feedback_replies add constraint feedback_replies_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;

-- feedback_replies.feedback_replies_sender_role_check
alter table public.feedback_replies add constraint feedback_replies_sender_role_check CHECK ((sender_role = ANY (ARRAY['user'::text, 'support'::text])));

-- form_documents.form_documents_approved_by_fkey
alter table public.form_documents add constraint form_documents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id);

-- form_documents.form_documents_created_by_fkey
alter table public.form_documents add constraint form_documents_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

-- form_documents.form_documents_recipient_user_id_fkey
alter table public.form_documents add constraint form_documents_recipient_user_id_fkey FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- form_documents.form_documents_status_check
alter table public.form_documents add constraint form_documents_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'issued'::text, 'awaiting_reply'::text, 'replied'::text])));

-- form_documents.form_documents_student_id_fkey
alter table public.form_documents add constraint form_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;

-- form_documents.form_documents_template_id_fkey
alter table public.form_documents add constraint form_documents_template_id_fkey FOREIGN KEY (template_id) REFERENCES form_templates(id) ON DELETE RESTRICT;

-- form_templates.form_templates_category_check
alter table public.form_templates add constraint form_templates_category_check CHECK ((category = ANY (ARRAY['certificate'::text, 'official'::text, 'administrative'::text])));

-- form_templates.form_templates_department_check
alter table public.form_templates add constraint form_templates_department_check CHECK ((department = ANY (ARRAY['school_admin'::text, 'academic'::text, 'school_affairs'::text, 'student_affairs'::text, 'guidance'::text, 'activity'::text, 'health'::text, 'gifted'::text, 'globe'::text, 'sport'::text])));

-- form_templates.form_templates_orientation_check
alter table public.form_templates add constraint form_templates_orientation_check CHECK ((orientation = ANY (ARRAY['portrait'::text, 'landscape'::text])));

-- form_templates.form_templates_signature_source_check
alter table public.form_templates add constraint form_templates_signature_source_check CHECK ((signature_source = ANY (ARRAY['none'::text, 'issuer'::text, 'principal'::text, 'both'::text])));

-- grades_records.grades_records_exam_period_check
alter table public.grades_records add constraint grades_records_exam_period_check CHECK ((exam_period = ANY (ARRAY[1, 2, 3])));

-- grades_records.grades_records_published_by_fkey
alter table public.grades_records add constraint grades_records_published_by_fkey FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL;

-- grades_records.grades_records_student_id_fkey
alter table public.grades_records add constraint grades_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- grades_records.grades_records_subject_id_fkey
alter table public.grades_records add constraint grades_records_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE;

-- guardian_student.guardian_student_guardian_id_fkey
alter table public.guardian_student add constraint guardian_student_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE;

-- guardian_student.guardian_student_student_id_fkey
alter table public.guardian_student add constraint guardian_student_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- guardians.guardians_user_id_fkey
alter table public.guardians add constraint guardians_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- guides.guides_audience_check
alter table public.guides add constraint guides_audience_check CHECK ((audience = ANY (ARRAY['general'::text, 'admin'::text, 'teacher'::text, 'student'::text, 'guardian'::text])));

-- guides.guides_created_by_fkey
alter table public.guides add constraint guides_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

-- import_logs.import_logs_performed_by_fkey
alter table public.import_logs add constraint import_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL;

-- login_log.login_log_event_type_check
alter table public.login_log add constraint login_log_event_type_check CHECK ((event_type = ANY (ARRAY['login'::text, 'logout'::text])));

-- maintenance_state.maintenance_state_id_check
alter table public.maintenance_state add constraint maintenance_state_id_check CHECK ((id = 1));

-- maintenance_state.maintenance_state_updated_by_fkey
alter table public.maintenance_state add constraint maintenance_state_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);

-- news.news_created_by_fkey
alter table public.news add constraint news_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

-- notification_drafts.notification_drafts_sender_id_fkey
alter table public.notification_drafts add constraint notification_drafts_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- notification_recipients.notification_recipients_notification_id
alter table public.notification_recipients add constraint notification_recipients_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE;

-- notification_recipients.notification_recipients_user_id_fkey
alter table public.notification_recipients add constraint notification_recipients_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- notifications.notifications_created_by_fkey
alter table public.notifications add constraint notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

-- notifications.notifications_kind_check
alter table public.notifications add constraint notifications_kind_check CHECK ((kind = ANY (ARRAY['general'::text, 'absence'::text, 'permission'::text, 'news'::text, 'alert'::text])));

-- official_day_marks.official_day_marks_attend_date_fkey
alter table public.official_day_marks add constraint official_day_marks_attend_date_fkey FOREIGN KEY (attend_date) REFERENCES official_attendance_days(attend_date) ON DELETE CASCADE;

-- official_day_marks.official_day_marks_status_check
alter table public.official_day_marks add constraint official_day_marks_status_check CHECK ((status = ANY (ARRAY['present'::text, 'absent'::text, 'excused'::text, 'pending'::text])));

-- official_day_marks.official_day_marks_student_id_fkey
alter table public.official_day_marks add constraint official_day_marks_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- period_times.period_times_kind_check
alter table public.period_times add constraint period_times_kind_check CHECK ((kind = ANY (ARRAY['assembly'::text, 'period'::text, 'break'::text, 'prayer'::text])));

-- period_times.period_times_season_check
alter table public.period_times add constraint period_times_season_check CHECK ((season = ANY (ARRAY['summer'::text, 'winter'::text, 'ramadan'::text])));

-- permission_grantors.permission_grantors_user_id_fkey
alter table public.permission_grantors add constraint permission_grantors_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- permission_request_students.permission_request_students_request
alter table public.permission_request_students add constraint permission_request_students_request_id_fkey FOREIGN KEY (request_id) REFERENCES permission_requests(id) ON DELETE CASCADE;

-- permission_request_students.permission_request_students_student
alter table public.permission_request_students add constraint permission_request_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- permission_requests.periods_required_when_scope_is_periods
alter table public.permission_requests add constraint periods_required_when_scope_is_periods CHECK ((((scope = 'day'::text) AND (period_numbers IS NULL)) OR ((scope = 'periods'::text) AND (period_numbers IS NOT NULL) AND (array_length(period_numbers, 1) > 0))));

-- permission_requests.permission_requests_created_by_fkey
alter table public.permission_requests add constraint permission_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id);

-- permission_requests.permission_requests_scope_check
alter table public.permission_requests add constraint permission_requests_scope_check CHECK ((scope = ANY (ARRAY['day'::text, 'periods'::text])));

-- permission_returns.permission_returns_returned_by_fkey
alter table public.permission_returns add constraint permission_returns_returned_by_fkey FOREIGN KEY (returned_by) REFERENCES users(id);

-- permission_returns.permission_returns_student_id_fkey
alter table public.permission_returns add constraint permission_returns_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- push_subscriptions.push_subscriptions_user_id_fkey
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- quiz_assignments.quiz_assignments_quiz_id_fkey
alter table public.quiz_assignments add constraint quiz_assignments_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

-- quiz_assignments.quiz_assignments_student_id_fkey
alter table public.quiz_assignments add constraint quiz_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- quiz_classes.quiz_classes_class_id_fkey
alter table public.quiz_classes add constraint quiz_classes_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- quiz_classes.quiz_classes_quiz_id_fkey
alter table public.quiz_classes add constraint quiz_classes_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

-- quiz_online.quiz_online_check
alter table public.quiz_online add constraint quiz_online_check CHECK ((closes_at > opens_at));

-- quiz_online.quiz_online_duration_min_check
alter table public.quiz_online add constraint quiz_online_duration_min_check CHECK (((duration_min >= 1) AND (duration_min <= 300)));

-- quiz_online.quiz_online_quiz_id_fkey
alter table public.quiz_online add constraint quiz_online_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

-- quiz_questions.quiz_questions_kind_check
alter table public.quiz_questions add constraint quiz_questions_kind_check CHECK ((kind = ANY (ARRAY['mcq'::text, 'truefalse'::text, 'match'::text, 'fill'::text, 'order'::text, 'short'::text, 'essay'::text])));

-- quiz_questions.quiz_questions_quiz_id_fkey
alter table public.quiz_questions add constraint quiz_questions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

-- quiz_submissions.quiz_submissions_class_id_fkey
alter table public.quiz_submissions add constraint quiz_submissions_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- quiz_submissions.quiz_submissions_marked_by_fkey
alter table public.quiz_submissions add constraint quiz_submissions_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL;

-- quiz_submissions.quiz_submissions_quiz_id_fkey
alter table public.quiz_submissions add constraint quiz_submissions_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

-- quiz_submissions.quiz_submissions_student_id_fkey
alter table public.quiz_submissions add constraint quiz_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- quizzes.quizzes_lang_check
alter table public.quizzes add constraint quizzes_lang_check CHECK ((lang = ANY (ARRAY['ar'::text, 'en'::text])));

-- quizzes.quizzes_mode_check
alter table public.quizzes add constraint quizzes_mode_check CHECK ((mode = ANY (ARRAY['omr'::text, 'paper'::text, 'online'::text])));

-- quizzes.quizzes_period_check
alter table public.quizzes add constraint quizzes_period_check CHECK ((period = ANY (ARRAY['period1'::text, 'period2'::text, 'final'::text])));

-- quizzes.quizzes_status_check
alter table public.quizzes add constraint quizzes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'ready'::text, 'marking'::text, 'closed'::text])));

-- quizzes.quizzes_subject_id_fkey
alter table public.quizzes add constraint quizzes_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;

-- quizzes.quizzes_teacher_id_fkey
alter table public.quizzes add constraint quizzes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;

-- schedule.schedule_class_id_fkey
alter table public.schedule add constraint schedule_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- schedule.schedule_day_of_week_check
alter table public.schedule add constraint schedule_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 5)));

-- schedule.schedule_day_periods_check
alter table public.schedule add constraint schedule_day_periods_check CHECK ((((day_of_week = ANY (ARRAY[1, 2])) AND ((period_no >= 1) AND (period_no <= 7))) OR ((day_of_week = ANY (ARRAY[3, 4, 5])) AND ((period_no >= 1) AND (period_no <= 6)))));

-- schedule.schedule_period_no_check
alter table public.schedule add constraint schedule_period_no_check CHECK (((period_no >= 1) AND (period_no <= 7)));

-- schedule.schedule_subject_id_fkey
alter table public.schedule add constraint schedule_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;

-- schedule.schedule_teacher_id_fkey
alter table public.schedule add constraint schedule_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- schedule.schedule_term_check
alter table public.schedule add constraint schedule_term_check CHECK ((term = ANY (ARRAY[1, 2])));

-- school_assets.school_assets_key_check
alter table public.school_assets add constraint school_assets_key_check CHECK ((key = ANY (ARRAY['stamp'::text, 'principal_signature'::text])));

-- school_assets.school_assets_updated_by_fkey
alter table public.school_assets add constraint school_assets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id);

-- school_events.school_events_approved_by_fkey
alter table public.school_events add constraint school_events_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;

-- school_events.school_events_organizer_id_fkey
alter table public.school_events add constraint school_events_organizer_id_fkey FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL;

-- school_events.school_events_stage_check
alter table public.school_events add constraint school_events_stage_check CHECK ((stage = ANY (ARRAY['draft'::text, 'participants'::text, 'consent'::text, 'permission'::text, 'attendance'::text, 'certificates'::text, 'report'::text, 'approved'::text])));

-- site_status_snapshots.site_status_snapshots_source_check
alter table public.site_status_snapshots add constraint site_status_snapshots_source_check CHECK ((source = ANY (ARRAY['scheduled'::text, 'manual'::text])));

-- site_status_snapshots.site_status_snapshots_verdict_check
alter table public.site_status_snapshots add constraint site_status_snapshots_verdict_check CHECK ((verdict = ANY (ARRAY['ok'::text, 'info'::text, 'warn'::text, 'crit'::text])));

-- sms_logs.sms_logs_guardian_id_fkey
alter table public.sms_logs add constraint sms_logs_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE SET NULL;

-- sms_logs.sms_logs_student_id_fkey
alter table public.sms_logs add constraint sms_logs_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;

-- student_enrollment.student_enrollment_class_id_fkey
alter table public.student_enrollment add constraint student_enrollment_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT;

-- student_enrollment.student_enrollment_student_id_fkey
alter table public.student_enrollment add constraint student_enrollment_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- student_referrals.student_referrals_counselor_id_fkey
alter table public.student_referrals add constraint student_referrals_counselor_id_fkey FOREIGN KEY (counselor_id) REFERENCES users(id) ON DELETE SET NULL;

-- student_referrals.student_referrals_deputy_id_fkey
alter table public.student_referrals add constraint student_referrals_deputy_id_fkey FOREIGN KEY (deputy_id) REFERENCES users(id) ON DELETE SET NULL;

-- student_referrals.student_referrals_guardian_id_fkey
alter table public.student_referrals add constraint student_referrals_guardian_id_fkey FOREIGN KEY (guardian_id) REFERENCES users(id) ON DELETE SET NULL;

-- student_referrals.student_referrals_status_check
alter table public.student_referrals add constraint student_referrals_status_check CHECK ((status = ANY (ARRAY['with_deputy'::text, 'with_counselor'::text, 'returned_to_counselor'::text, 'closed'::text, 'with_guardian'::text, 'guardian_replied'::text, 'archived'::text])));

-- student_referrals.student_referrals_student_id_fkey
alter table public.student_referrals add constraint student_referrals_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- student_referrals.student_referrals_teacher_id_fkey
alter table public.student_referrals add constraint student_referrals_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL;

-- student_results.student_results_report_type_check
alter table public.student_results add constraint student_results_report_type_check CHECK ((report_type = ANY (ARRAY['period1'::text, 'period2'::text, 'final'::text])));

-- student_results.student_results_student_id_fkey
alter table public.student_results add constraint student_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- student_results.student_results_uploaded_by_fkey
alter table public.student_results add constraint student_results_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

-- students.students_user_id_fkey
alter table public.students add constraint students_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- subject_aliases.subject_aliases_grade_check
alter table public.subject_aliases add constraint subject_aliases_grade_check CHECK ((grade = ANY (ARRAY[1, 2, 3])));

-- subjects.subjects_grade_check
alter table public.subjects add constraint subjects_grade_check CHECK ((grade = ANY (ARRAY[1, 2, 3])));

-- subjects.subjects_term_check
alter table public.subjects add constraint subjects_term_check CHECK ((term = ANY (ARRAY[1, 2])));

-- substitute_periods.substitute_periods_absent_teacher_id_fkey
alter table public.substitute_periods add constraint substitute_periods_absent_teacher_id_fkey FOREIGN KEY (absent_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

-- substitute_periods.substitute_periods_class_id_fkey
alter table public.substitute_periods add constraint substitute_periods_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- substitute_periods.substitute_periods_cover_teacher_id_fkey
alter table public.substitute_periods add constraint substitute_periods_cover_teacher_id_fkey FOREIGN KEY (cover_teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- substitute_periods.substitute_periods_schedule_id_fkey
alter table public.substitute_periods add constraint substitute_periods_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES schedule(id) ON DELETE CASCADE;

-- supervision_duty.supervision_duty_day_of_week_check
alter table public.supervision_duty add constraint supervision_duty_day_of_week_check CHECK (((day_of_week >= 1) AND (day_of_week <= 5)));

-- supervision_duty.supervision_duty_kind_check
alter table public.supervision_duty add constraint supervision_duty_kind_check CHECK ((kind = ANY (ARRAY['teacher'::text, 'supervisor'::text])));

-- supervision_duty.supervision_duty_user_id_fkey
alter table public.supervision_duty add constraint supervision_duty_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- teacher_follow_up.teacher_follow_up_class_id_fkey
alter table public.teacher_follow_up add constraint teacher_follow_up_class_id_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- teacher_follow_up.teacher_follow_up_period_check
alter table public.teacher_follow_up add constraint teacher_follow_up_period_check CHECK ((period = ANY (ARRAY['الفترة الأولى'::text, 'الفترة الثانية'::text])));

-- teacher_follow_up.teacher_follow_up_student_id_fkey
alter table public.teacher_follow_up add constraint teacher_follow_up_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- teacher_follow_up.teacher_follow_up_teacher_id_fkey
alter table public.teacher_follow_up add constraint teacher_follow_up_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- teacher_granted_tabs.teacher_granted_tabs_tab_key_check
alter table public.teacher_granted_tabs add constraint teacher_granted_tabs_tab_key_check CHECK ((tab_key = ANY (ARRAY['permissions'::text, 'news'::text])));

-- teacher_granted_tabs.teacher_granted_tabs_teacher_id_fkey
alter table public.teacher_granted_tabs add constraint teacher_granted_tabs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- teacher_hidden_tabs.teacher_hidden_tabs_tab_key_check
alter table public.teacher_hidden_tabs add constraint teacher_hidden_tabs_tab_key_check CHECK ((tab_key = ANY (ARRAY['attendance'::text, 'schedule'::text, 'records'::text, 'reports'::text, 'notify'::text])));

-- teacher_hidden_tabs.teacher_hidden_tabs_teacher_id_fkey
alter table public.teacher_hidden_tabs add constraint teacher_hidden_tabs_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- teachers.teachers_user_id_fkey
alter table public.teachers add constraint teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- user_signatures.user_signatures_user_id_fkey
alter table public.user_signatures add constraint user_signatures_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- users.users_id_fkey
alter table public.users add constraint users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ---------------------------------------------------------------------
--  5) الفهارس — 84
-- ---------------------------------------------------------------------

-- absence_warnings_once_idx
CREATE UNIQUE INDEX absence_warnings_once_idx ON public.absence_warnings USING btree (student_id, stage, COALESCE(academic_year, ''::text), COALESCE(term, 0));

-- attendance_reminders_date_idx
CREATE INDEX attendance_reminders_date_idx ON public.attendance_reminders USING btree (remind_date);

-- duty_roster_date_idx
CREATE INDEX duty_roster_date_idx ON public.duty_roster USING btree (duty_date);

-- duty_roster_user_idx
CREATE INDEX duty_roster_user_idx ON public.duty_roster USING btree (user_a, user_b);

-- events_date_idx
CREATE INDEX events_date_idx ON public.school_events USING btree (event_date);

-- events_stage_idx
CREATE INDEX events_stage_idx ON public.school_events USING btree (stage);

-- exam_slots_class_idx
CREATE INDEX exam_slots_class_idx ON public.exam_slots USING btree (class_id);

-- exam_slots_grade_idx
CREATE INDEX exam_slots_grade_idx ON public.exam_slots USING btree (grade);

-- exam_slots_term_idx
CREATE INDEX exam_slots_term_idx ON public.exam_slots USING btree (exam_term_id);

-- form_documents_created_idx
CREATE INDEX form_documents_created_idx ON public.form_documents USING btree (created_at DESC);

-- form_documents_creator_idx
CREATE INDEX form_documents_creator_idx ON public.form_documents USING btree (created_by);

-- form_documents_recipient_idx
CREATE INDEX form_documents_recipient_idx ON public.form_documents USING btree (recipient_user_id);

-- form_documents_status_idx
CREATE INDEX form_documents_status_idx ON public.form_documents USING btree (status);

-- form_templates_category_idx
CREATE INDEX form_templates_category_idx ON public.form_templates USING btree (category, sort_order);

-- form_templates_department_idx
CREATE INDEX form_templates_department_idx ON public.form_templates USING btree (department, sort_order);

-- grade_entries_lookup
CREATE INDEX grade_entries_lookup ON public.grade_entries USING btree (teacher_user_id, academic_year, term, class_id);

-- idx_academic_calendar_start
CREATE INDEX idx_academic_calendar_start ON public.academic_calendar USING btree (start_date);

-- idx_admin_missing_notes_student_date
CREATE INDEX idx_admin_missing_notes_student_date ON public.admin_missing_notes USING btree (student_id, note_date);

-- idx_admin_roles_user
CREATE INDEX idx_admin_roles_user ON public.admin_roles USING btree (user_id);

-- idx_announcement_banners_window
CREATE INDEX idx_announcement_banners_window ON public.announcement_banners USING btree (is_active, starts_at, ends_at);

-- idx_catt_date
CREATE INDEX idx_catt_date ON public.class_attendance USING btree (attend_date, status);

-- idx_catt_sched
CREATE INDEX idx_catt_sched ON public.class_attendance USING btree (schedule_id, attend_date);

-- idx_catt_student
CREATE INDEX idx_catt_student ON public.class_attendance USING btree (student_id, attend_date);

-- idx_catt_year
CREATE INDEX idx_catt_year ON public.class_attendance USING btree (academic_year);

-- idx_class_attendance_date_status
CREATE INDEX idx_class_attendance_date_status ON public.class_attendance USING btree (attend_date, status);

-- idx_classes_year
CREATE INDEX idx_classes_year ON public.classes USING btree (academic_year, grade);

-- idx_daily_date
CREATE INDEX idx_daily_date ON public.daily_attendance USING btree (attend_date);

-- idx_daily_student
CREATE INDEX idx_daily_student ON public.daily_attendance USING btree (student_id, attend_date);

-- idx_enroll_class
CREATE INDEX idx_enroll_class ON public.student_enrollment USING btree (class_id, academic_year);

-- idx_enroll_year
CREATE INDEX idx_enroll_year ON public.student_enrollment USING btree (academic_year, status);

-- idx_excuse_range
CREATE INDEX idx_excuse_range ON public.excused_absences USING btree (date_from, date_to);

-- idx_excuse_student
CREATE INDEX idx_excuse_student ON public.excused_absences USING btree (student_id, date_from, date_to);

-- idx_feedback_created
CREATE INDEX idx_feedback_created ON public.feedback USING btree (created_at DESC);

-- idx_grades_pub
CREATE INDEX idx_grades_pub ON public.grades_records USING btree (is_published, academic_year);

-- idx_grades_student
CREATE INDEX idx_grades_student ON public.grades_records USING btree (student_id, academic_year);

-- idx_gs_guardian
CREATE INDEX idx_gs_guardian ON public.guardian_student USING btree (guardian_id);

-- idx_gs_student
CREATE INDEX idx_gs_student ON public.guardian_student USING btree (student_id);

-- idx_guardians_mobile
CREATE INDEX idx_guardians_mobile ON public.guardians USING btree (mobile);

-- idx_guides_audience
CREATE INDEX idx_guides_audience ON public.guides USING btree (audience, sort_order);

-- idx_import_recent
CREATE INDEX idx_import_recent ON public.import_logs USING btree (started_at DESC);

-- idx_ndrafts_status
CREATE INDEX idx_ndrafts_status ON public.notification_drafts USING btree (status, created_at);

-- idx_news_published
CREATE INDEX idx_news_published ON public.news USING btree (is_published, published_at DESC);

-- idx_notes_pending
CREATE INDEX idx_notes_pending ON public.behavior_notes USING btree (review_status) WHERE (review_status = 'pending'::review_status_enum);

-- idx_notes_student
CREATE INDEX idx_notes_student ON public.behavior_notes USING btree (student_id, review_status);

-- idx_notif_recipients_user
CREATE INDEX idx_notif_recipients_user ON public.notification_recipients USING btree (user_id, read_at);

-- idx_notifications_created
CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);

-- idx_period_times_season
CREATE INDEX idx_period_times_season ON public.period_times USING btree (season, sort_order);

-- idx_permission_requests_date
CREATE INDEX idx_permission_requests_date ON public.permission_requests USING btree (request_date);

-- idx_permission_returns_date
CREATE INDEX idx_permission_returns_date ON public.permission_returns USING btree (return_date);

-- idx_prs_student
CREATE INDEX idx_prs_student ON public.permission_request_students USING btree (student_id);

-- idx_push_subs_user
CREATE INDEX idx_push_subs_user ON public.push_subscriptions USING btree (user_id);

-- idx_sched_class
CREATE INDEX idx_sched_class ON public.schedule USING btree (class_id, day_of_week);

-- idx_sched_teacher
CREATE INDEX idx_sched_teacher ON public.schedule USING btree (teacher_id, academic_year);

-- idx_sms_date
CREATE INDEX idx_sms_date ON public.sms_logs USING btree (created_at DESC);

-- idx_sms_status
CREATE INDEX idx_sms_status ON public.sms_logs USING btree (status);

-- idx_students_device_uid
CREATE UNIQUE INDEX idx_students_device_uid ON public.students USING btree (device_uid) WHERE (device_uid IS NOT NULL);

-- idx_students_name
CREATE INDEX idx_students_name ON public.students USING btree (full_name);

-- idx_students_nid
CREATE INDEX idx_students_nid ON public.students USING btree (national_id);

-- idx_unmatched_open
CREATE INDEX idx_unmatched_open ON public.unmatched_logs USING btree (resolved, punch_time);

-- idx_users_role
CREATE INDEX idx_users_role ON public.users USING btree (role) WHERE is_active;

-- login_log_created_at_idx
CREATE INDEX login_log_created_at_idx ON public.login_log USING btree (created_at DESC);

-- login_log_national_id_idx
CREATE INDEX login_log_national_id_idx ON public.login_log USING btree (national_id);

-- media_event_idx
CREATE INDEX media_event_idx ON public.event_media USING btree (event_id);

-- official_day_marks_late_idx
CREATE INDEX official_day_marks_late_idx ON public.official_day_marks USING btree (attend_date) WHERE (late_minutes > 0);

-- official_day_marks_student_idx
CREATE INDEX official_day_marks_student_idx ON public.official_day_marks USING btree (student_id, status);

-- participants_consent_doc_idx
CREATE INDEX participants_consent_doc_idx ON public.event_participants USING btree (consent_doc_id);

-- participants_event_idx
CREATE INDEX participants_event_idx ON public.event_participants USING btree (event_id);

-- participants_student_idx
CREATE INDEX participants_student_idx ON public.event_participants USING btree (student_id);

-- questions_quiz_idx
CREATE INDEX questions_quiz_idx ON public.quiz_questions USING btree (quiz_id, sort_order);

-- quiz_assignments_quiz
CREATE INDEX quiz_assignments_quiz ON public.quiz_assignments USING btree (quiz_id);

-- quizclasses_quiz_idx
CREATE INDEX quizclasses_quiz_idx ON public.quiz_classes USING btree (quiz_id);

-- quizzes_teacher_idx
CREATE INDEX quizzes_teacher_idx ON public.quizzes USING btree (teacher_id);

-- referrals_status_idx
CREATE INDEX referrals_status_idx ON public.student_referrals USING btree (status);

-- referrals_student_idx
CREATE INDEX referrals_student_idx ON public.student_referrals USING btree (student_id);

-- subs_quiz_idx
CREATE INDEX subs_quiz_idx ON public.quiz_submissions USING btree (quiz_id);

-- subs_student_idx
CREATE INDEX subs_student_idx ON public.quiz_submissions USING btree (student_id);

-- supervision_day_idx
CREATE INDEX supervision_day_idx ON public.supervision_duty USING btree (day_of_week);

-- uq_device_student_active
CREATE UNIQUE INDEX uq_device_student_active ON public.device_mapping USING btree (student_id) WHERE is_active;

-- uq_device_uid_active
CREATE UNIQUE INDEX uq_device_uid_active ON public.device_mapping USING btree (device_uid) WHERE is_active;

-- uq_grade_record
CREATE UNIQUE INDEX uq_grade_record ON public.grades_records USING btree (student_id, subject_id, term, exam_period, academic_year);

-- uq_guardians_mobile
CREATE UNIQUE INDEX uq_guardians_mobile ON public.guardians USING btree (mobile);

-- uq_guardians_nid
CREATE UNIQUE INDEX uq_guardians_nid ON public.guardians USING btree (national_id) WHERE (national_id IS NOT NULL);

-- uq_schedule_slot
CREATE UNIQUE INDEX uq_schedule_slot ON public.schedule USING btree (class_id, day_of_week, period_no, term, academic_year);

-- uq_subjects_name_grade_term
CREATE UNIQUE INDEX uq_subjects_name_grade_term ON public.subjects USING btree (name, grade, term);


-- ---------------------------------------------------------------------
--  6) العروض (views) — 5
-- ---------------------------------------------------------------------

-- v_active_students
create or replace view public.v_active_students as
 SELECT s.id AS student_id,
    s.national_id,
    s.identity_type,
    s.full_name,
    c.class_no,
    c.grade,
    c.track,
    se.status,
    se.academic_year
   FROM ((students s
     JOIN student_enrollment se ON ((se.student_id = s.id)))
     JOIN classes c ON ((c.id = se.class_id)))
  WHERE ((se.academic_year = active_year()) AND s.is_active);

-- v_active_subjects
create or replace view public.v_active_subjects as
 SELECT id,
    name,
    grade,
    term,
    weekly_periods
   FROM subjects
  WHERE (term = active_term());

-- v_missing_alerts
create or replace view public.v_missing_alerts as
 SELECT ca.student_id,
    s.full_name,
    c.class_no,
    ca.attend_date,
    sch.period_no,
    da.punch_time
   FROM ((((class_attendance ca
     JOIN students s ON ((s.id = ca.student_id)))
     JOIN schedule sch ON ((sch.id = ca.schedule_id)))
     JOIN classes c ON ((c.id = sch.class_id)))
     JOIN daily_attendance da ON (((da.student_id = ca.student_id) AND (da.attend_date = ca.attend_date))))
  WHERE ((ca.status = 'absent'::class_att_status) AND (ca.attend_date = today_ksa()) AND (NOT is_excused(ca.student_id, ca.attend_date)));

-- v_students_without_device
create or replace view public.v_students_without_device as
 SELECT s.id,
    s.national_id,
    s.full_name,
    c.class_no
   FROM ((students s
     JOIN student_enrollment se ON (((se.student_id = s.id) AND (se.academic_year = active_year()))))
     JOIN classes c ON ((c.id = se.class_id)))
  WHERE (s.is_active AND (NOT (EXISTS ( SELECT 1
           FROM device_mapping dm
          WHERE ((dm.student_id = s.id) AND dm.is_active)))));

-- v_unmarked_periods
create or replace view public.v_unmarked_periods as
 SELECT sch.id AS schedule_id,
    c.class_no,
    t.full_name AS teacher_name,
    sch.period_no,
    sch.day_of_week
   FROM ((schedule sch
     JOIN classes c ON ((c.id = sch.class_id)))
     JOIN teachers t ON ((t.id = sch.teacher_id)))
  WHERE ((sch.academic_year = active_year()) AND (sch.day_of_week = (((EXTRACT(isodow FROM today_ksa()))::integer % 7) + 1)) AND (NOT (EXISTS ( SELECT 1
           FROM class_attendance ca
          WHERE ((ca.schedule_id = sch.id) AND (ca.attend_date = today_ksa()))))));


-- ---------------------------------------------------------------------
--  7) تفعيل RLS — 72
-- ---------------------------------------------------------------------

-- absence_warnings
alter table public.absence_warnings enable row level security;

-- academic_calendar
alter table public.academic_calendar enable row level security;

-- admin_missing_notes
alter table public.admin_missing_notes enable row level security;

-- admin_roles
alter table public.admin_roles enable row level security;

-- announcement_banners
alter table public.announcement_banners enable row level security;

-- announcement_dismissals
alter table public.announcement_dismissals enable row level security;

-- attendance_reminders
alter table public.attendance_reminders enable row level security;

-- behavior_notes
alter table public.behavior_notes enable row level security;

-- class_attendance
alter table public.class_attendance enable row level security;

-- classes
alter table public.classes enable row level security;

-- daily_attendance
alter table public.daily_attendance enable row level security;

-- device_mapping
alter table public.device_mapping enable row level security;

-- devices
alter table public.devices enable row level security;

-- duty_roster
alter table public.duty_roster enable row level security;

-- event_media
alter table public.event_media enable row level security;

-- event_participants
alter table public.event_participants enable row level security;

-- exam_slots
alter table public.exam_slots enable row level security;

-- exam_terms
alter table public.exam_terms enable row level security;

-- excused_absences
alter table public.excused_absences enable row level security;

-- feedback
alter table public.feedback enable row level security;

-- feedback_replies
alter table public.feedback_replies enable row level security;

-- form_counters
alter table public.form_counters enable row level security;

-- form_documents
alter table public.form_documents enable row level security;

-- form_templates
alter table public.form_templates enable row level security;

-- grade_entries
alter table public.grade_entries enable row level security;

-- grades_records
alter table public.grades_records enable row level security;

-- guardian_student
alter table public.guardian_student enable row level security;

-- guardians
alter table public.guardians enable row level security;

-- guides
alter table public.guides enable row level security;

-- import_logs
alter table public.import_logs enable row level security;

-- login_log
alter table public.login_log enable row level security;

-- maintenance_state
alter table public.maintenance_state enable row level security;

-- news
alter table public.news enable row level security;

-- notification_drafts
alter table public.notification_drafts enable row level security;

-- notification_recipients
alter table public.notification_recipients enable row level security;

-- notifications
alter table public.notifications enable row level security;

-- official_attendance_days
alter table public.official_attendance_days enable row level security;

-- official_day_marks
alter table public.official_day_marks enable row level security;

-- period_times
alter table public.period_times enable row level security;

-- permission_grantors
alter table public.permission_grantors enable row level security;

-- permission_request_students
alter table public.permission_request_students enable row level security;

-- permission_requests
alter table public.permission_requests enable row level security;

-- permission_returns
alter table public.permission_returns enable row level security;

-- push_subscriptions
alter table public.push_subscriptions enable row level security;

-- quiz_assignments
alter table public.quiz_assignments enable row level security;

-- quiz_classes
alter table public.quiz_classes enable row level security;

-- quiz_online
alter table public.quiz_online enable row level security;

-- quiz_questions
alter table public.quiz_questions enable row level security;

-- quiz_submissions
alter table public.quiz_submissions enable row level security;

-- quizzes
alter table public.quizzes enable row level security;

-- role_permissions
alter table public.role_permissions enable row level security;

-- schedule
alter table public.schedule enable row level security;

-- school_assets
alter table public.school_assets enable row level security;

-- school_events
alter table public.school_events enable row level security;

-- settings
alter table public.settings enable row level security;

-- site_status_snapshots
alter table public.site_status_snapshots enable row level security;

-- sms_logs
alter table public.sms_logs enable row level security;

-- student_enrollment
alter table public.student_enrollment enable row level security;

-- student_referrals
alter table public.student_referrals enable row level security;

-- student_results
alter table public.student_results enable row level security;

-- students
alter table public.students enable row level security;

-- subject_aliases
alter table public.subject_aliases enable row level security;

-- subjects
alter table public.subjects enable row level security;

-- substitute_periods
alter table public.substitute_periods enable row level security;

-- supervision_duty
alter table public.supervision_duty enable row level security;

-- teacher_follow_up
alter table public.teacher_follow_up enable row level security;

-- teacher_granted_tabs
alter table public.teacher_granted_tabs enable row level security;

-- teacher_hidden_tabs
alter table public.teacher_hidden_tabs enable row level security;

-- teachers
alter table public.teachers enable row level security;

-- unmatched_logs
alter table public.unmatched_logs enable row level security;

-- user_signatures
alter table public.user_signatures enable row level security;

-- users
alter table public.users enable row level security;


-- ---------------------------------------------------------------------
--  8) سياسات الصلاحيات (public + storage) — 235
-- ---------------------------------------------------------------------

-- public.absence_warnings: sa_warn_read
create policy sa_warn_read on public.absence_warnings as PERMISSIVE for SELECT to public
  using (sa_is_staff());

-- public.absence_warnings: sa_warn_write
create policy sa_warn_write on public.absence_warnings as PERMISSIVE for ALL to public
  using (sa_can_manage())
  with check (sa_can_manage());

-- public.academic_calendar: admin manage academic_calendar
create policy "admin manage academic_calendar" on public.academic_calendar as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::user_role)))));

-- public.academic_calendar: calendar_admin_write
create policy calendar_admin_write on public.academic_calendar as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true)))))
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true)))));

-- public.academic_calendar: calendar_public_read
create policy calendar_public_read on public.academic_calendar as PERMISSIVE for SELECT to public
  using ((is_active = true));

-- public.academic_calendar: read academic_calendar
create policy "read academic_calendar" on public.academic_calendar as PERMISSIVE for SELECT to public
  using (((is_active = true) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::user_role))))));

-- public.academic_calendar: read active calendar
create policy "read active calendar" on public.academic_calendar as PERMISSIVE for SELECT to authenticated
  using (is_active);

-- public.admin_missing_notes: amn_delete
create policy amn_delete on public.admin_missing_notes as PERMISSIVE for DELETE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.admin_missing_notes: amn_insert
create policy amn_insert on public.admin_missing_notes as PERMISSIVE for INSERT to public
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.admin_missing_notes: amn_read
create policy amn_read on public.admin_missing_notes as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (users.is_active = true)))));

-- public.admin_roles: admin_roles_read
create policy admin_roles_read on public.admin_roles as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.admin_roles: admin_roles_write
create policy admin_roles_write on public.admin_roles as PERMISSIVE for ALL to authenticated
  using (has_admin_role('principal'::admin_role_type))
  with check (has_admin_role('principal'::admin_role_type));

-- public.announcement_banners: ab_admin_read
create policy ab_admin_read on public.announcement_banners as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.announcement_banners: ab_admin_write
create policy ab_admin_write on public.announcement_banners as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))))
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.announcement_banners: ab_read_active
create policy ab_read_active on public.announcement_banners as PERMISSIVE for SELECT to public
  using (((is_active = true) AND (now() >= starts_at) AND (now() <= ends_at) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.is_active = true))))));

-- public.announcement_dismissals: ad_own_insert
create policy ad_own_insert on public.announcement_dismissals as PERMISSIVE for INSERT to public
  with check ((user_id = auth.uid()));

-- public.announcement_dismissals: ad_own_read
create policy ad_own_read on public.announcement_dismissals as PERMISSIVE for SELECT to public
  using ((user_id = auth.uid()));

-- public.attendance_reminders: managers read reminders
create policy "managers read reminders" on public.attendance_reminders as PERMISSIVE for SELECT to authenticated
  using (is_form_manager());

-- public.behavior_notes: notes_admin_delete
create policy notes_admin_delete on public.behavior_notes as PERMISSIVE for DELETE to authenticated
  using (has_admin_role('principal'::admin_role_type));

-- public.behavior_notes: notes_admin_read
create policy notes_admin_read on public.behavior_notes as PERMISSIVE for SELECT to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type, 'counselor'::admin_role_type]));

-- public.behavior_notes: notes_guardian_read
create policy notes_guardian_read on public.behavior_notes as PERMISSIVE for SELECT to authenticated
  using (((review_status = 'approved'::review_status_enum) AND is_guardian_of(student_id)));

-- public.behavior_notes: notes_review
create policy notes_review on public.behavior_notes as PERMISSIVE for UPDATE to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'counselor'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'counselor'::admin_role_type]));

-- public.behavior_notes: notes_teacher_insert
create policy notes_teacher_insert on public.behavior_notes as PERMISSIVE for INSERT to authenticated
  with check (((teacher_id = current_teacher_id()) AND teaches_student(student_id) AND (review_status = 'pending'::review_status_enum)));

-- public.behavior_notes: notes_teacher_read
create policy notes_teacher_read on public.behavior_notes as PERMISSIVE for SELECT to authenticated
  using ((teacher_id = current_teacher_id()));

-- public.class_attendance: catt_admin_read
create policy catt_admin_read on public.class_attendance as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.class_attendance: catt_admin_write
create policy catt_admin_write on public.class_attendance as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type, 'clerk'::admin_role_type]));

-- public.class_attendance: catt_guardian_read
create policy catt_guardian_read on public.class_attendance as PERMISSIVE for SELECT to authenticated
  using (is_guardian_of(student_id));

-- public.class_attendance: catt_self_read
create policy catt_self_read on public.class_attendance as PERMISSIVE for SELECT to authenticated
  using ((student_id = current_student_id()));

-- public.class_attendance: catt_teacher_insert
create policy catt_teacher_insert on public.class_attendance as PERMISSIVE for INSERT to authenticated
  with check (((attend_date = today_ksa()) AND owns_schedule(schedule_id)));

-- public.class_attendance: catt_teacher_read
create policy catt_teacher_read on public.class_attendance as PERMISSIVE for SELECT to authenticated
  using (owns_schedule(schedule_id));

-- public.class_attendance: catt_teacher_update
create policy catt_teacher_update on public.class_attendance as PERMISSIVE for UPDATE to authenticated
  using (((attend_date = today_ksa()) AND owns_schedule(schedule_id)))
  with check (((attend_date = today_ksa()) AND owns_schedule(schedule_id)));

-- public.class_attendance: substitute teacher can insert class_at
create policy "substitute teacher can insert class_attendance" on public.class_attendance as PERMISSIVE for INSERT to authenticated
  with check (((recorded_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM (substitute_periods sp
     JOIN teachers t ON ((t.id = sp.cover_teacher_id)))
  WHERE ((sp.schedule_id = class_attendance.schedule_id) AND (sp.attend_date = class_attendance.attend_date) AND (t.user_id = auth.uid()))))));

-- public.class_attendance: substitute teacher can update class_at
create policy "substitute teacher can update class_attendance" on public.class_attendance as PERMISSIVE for UPDATE to authenticated
  using ((EXISTS ( SELECT 1
   FROM (substitute_periods sp
     JOIN teachers t ON ((t.id = sp.cover_teacher_id)))
  WHERE ((sp.schedule_id = class_attendance.schedule_id) AND (sp.attend_date = class_attendance.attend_date) AND (t.user_id = auth.uid())))));

-- public.classes: classes_read
create policy classes_read on public.classes as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.classes: classes_write
create policy classes_write on public.classes as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.daily_attendance: daily_admin_read
create policy daily_admin_read on public.daily_attendance as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.daily_attendance: daily_admin_write
create policy daily_admin_write on public.daily_attendance as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type, 'clerk'::admin_role_type]));

-- public.daily_attendance: daily_guardian_read
create policy daily_guardian_read on public.daily_attendance as PERMISSIVE for SELECT to authenticated
  using (is_guardian_of(student_id));

-- public.daily_attendance: daily_self_read
create policy daily_self_read on public.daily_attendance as PERMISSIVE for SELECT to authenticated
  using ((student_id = current_student_id()));

-- public.daily_attendance: daily_teacher_read
create policy daily_teacher_read on public.daily_attendance as PERMISSIVE for SELECT to authenticated
  using (teaches_student(student_id));

-- public.device_mapping: mapping_read
create policy mapping_read on public.device_mapping as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.device_mapping: mapping_write
create policy mapping_write on public.device_mapping as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.devices: devices_read
create policy devices_read on public.devices as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.devices: devices_service_read
create policy devices_service_read on public.devices as PERMISSIVE for SELECT to service_role
  using (true);

-- public.devices: devices_service_write
create policy devices_service_write on public.devices as PERMISSIVE for ALL to service_role
  using (true)
  with check (true);

-- public.devices: devices_write
create policy devices_write on public.devices as PERMISSIVE for ALL to authenticated
  using (has_admin_role('principal'::admin_role_type))
  with check (has_admin_role('principal'::admin_role_type));

-- public.duty_roster: manage duty
create policy "manage duty" on public.duty_roster as PERMISSIVE for ALL to authenticated
  using (is_form_manager())
  with check (is_form_manager());

-- public.duty_roster: read duty
create policy "read duty" on public.duty_roster as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.event_media: manage media
create policy "manage media" on public.event_media as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM school_events e
  WHERE ((e.id = event_media.event_id) AND ((e.organizer_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text]))))))
  with check (true);

-- public.event_media: read media
create policy "read media" on public.event_media as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.event_participants: guardian consents
create policy "guardian consents" on public.event_participants as PERMISSIVE for UPDATE to authenticated
  using ((EXISTS ( SELECT 1
   FROM (guardian_student gs
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = event_participants.student_id) AND (g.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM (guardian_student gs
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = event_participants.student_id) AND (g.user_id = auth.uid())))));

-- public.event_participants: manage participants
create policy "manage participants" on public.event_participants as PERMISSIVE for ALL to authenticated
  using (ev_is_manager(event_id, ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text]))
  with check (ev_is_manager(event_id, ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text]));

-- public.event_participants: read participants
create policy "read participants" on public.event_participants as PERMISSIVE for SELECT to authenticated
  using ((ev_is_manager(event_id, ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text, 'activity_leader'::text]) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = event_participants.student_id) AND (s.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (guardian_student gs
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = event_participants.student_id) AND (g.user_id = auth.uid()))))));

-- public.exam_slots: manage exam slots
create policy "manage exam slots" on public.exam_slots as PERMISSIVE for ALL to authenticated
  using (has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text]))
  with check (has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text]));

-- public.exam_slots: read exam slots
create policy "read exam slots" on public.exam_slots as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM exam_terms t
  WHERE ((t.id = exam_slots.exam_term_id) AND (t.is_published OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text]))))));

-- public.exam_terms: manage exam terms
create policy "manage exam terms" on public.exam_terms as PERMISSIVE for ALL to authenticated
  using (has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text]))
  with check (has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text]));

-- public.exam_terms: read exam terms
create policy "read exam terms" on public.exam_terms as PERMISSIVE for SELECT to authenticated
  using ((is_published OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text])));

-- public.excused_absences: excuse_admin_read
create policy excuse_admin_read on public.excused_absences as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.excused_absences: excuse_guardian_read
create policy excuse_guardian_read on public.excused_absences as PERMISSIVE for SELECT to authenticated
  using (is_guardian_of(student_id));

-- public.excused_absences: excuse_self_read
create policy excuse_self_read on public.excused_absences as PERMISSIVE for SELECT to authenticated
  using ((student_id = current_student_id()));

-- public.excused_absences: excuse_teacher_read
create policy excuse_teacher_read on public.excused_absences as PERMISSIVE for SELECT to authenticated
  using (teaches_student(student_id));

-- public.excused_absences: excuse_write
create policy excuse_write on public.excused_absences as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type, 'counselor'::admin_role_type, 'clerk'::admin_role_type, 'activity_leader'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type, 'counselor'::admin_role_type, 'clerk'::admin_role_type, 'activity_leader'::admin_role_type]));

-- public.feedback: feedback_admin_delete
create policy feedback_admin_delete on public.feedback as PERMISSIVE for DELETE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true)))));

-- public.feedback: feedback_admin_read
create policy feedback_admin_read on public.feedback as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true)))));

-- public.feedback: feedback_admin_update
create policy feedback_admin_update on public.feedback as PERMISSIVE for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true)))));

-- public.feedback: feedback_public_insert
create policy feedback_public_insert on public.feedback as PERMISSIVE for INSERT to public
  with check (true);

-- public.feedback: support manage all tickets
create policy "support manage all tickets" on public.feedback as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM admin_roles ar
  WHERE ((ar.user_id = auth.uid()) AND ((ar.role_type = 'tech_support'::admin_role_type) OR (ar.role_type IN ( SELECT role_permissions.role_type
           FROM role_permissions
          WHERE (role_permissions.permission = 'feedback'::text))))))))
  with check ((EXISTS ( SELECT 1
   FROM admin_roles ar
  WHERE ((ar.user_id = auth.uid()) AND ((ar.role_type = 'tech_support'::admin_role_type) OR (ar.role_type IN ( SELECT role_permissions.role_type
           FROM role_permissions
          WHERE (role_permissions.permission = 'feedback'::text))))))));

-- public.feedback: user insert own ticket
create policy "user insert own ticket" on public.feedback as PERMISSIVE for INSERT to authenticated
  with check ((user_id = auth.uid()));

-- public.feedback: user read own tickets
create policy "user read own tickets" on public.feedback as PERMISSIVE for SELECT to authenticated
  using ((user_id = auth.uid()));

-- public.feedback_replies: support read all replies
create policy "support read all replies" on public.feedback_replies as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM admin_roles ar
  WHERE ((ar.user_id = auth.uid()) AND ((ar.role_type = 'tech_support'::admin_role_type) OR (ar.role_type IN ( SELECT role_permissions.role_type
           FROM role_permissions
          WHERE (role_permissions.permission = 'feedback'::text))))))));

-- public.feedback_replies: support reply on any ticket
create policy "support reply on any ticket" on public.feedback_replies as PERMISSIVE for INSERT to authenticated
  with check (((sender_id = auth.uid()) AND (sender_role = 'support'::text) AND (EXISTS ( SELECT 1
   FROM admin_roles ar
  WHERE ((ar.user_id = auth.uid()) AND ((ar.role_type = 'tech_support'::admin_role_type) OR (ar.role_type IN ( SELECT role_permissions.role_type
           FROM role_permissions
          WHERE (role_permissions.permission = 'feedback'::text)))))))));

-- public.feedback_replies: user read own ticket replies
create policy "user read own ticket replies" on public.feedback_replies as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM feedback f
  WHERE ((f.id = feedback_replies.feedback_id) AND (f.user_id = auth.uid())))));

-- public.feedback_replies: user reply on own ticket
create policy "user reply on own ticket" on public.feedback_replies as PERMISSIVE for INSERT to authenticated
  with check (((sender_id = auth.uid()) AND (sender_role = 'user'::text) AND (EXISTS ( SELECT 1
   FROM feedback f
  WHERE ((f.id = feedback_replies.feedback_id) AND (f.user_id = auth.uid()))))));

-- public.form_documents: approver decides
create policy "approver decides" on public.form_documents as PERMISSIVE for UPDATE to authenticated
  using (is_form_approver())
  with check (is_form_approver());

-- public.form_documents: edit own pending document
create policy "edit own pending document" on public.form_documents as PERMISSIVE for UPDATE to authenticated
  using (((created_by = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'rejected'::text]))))
  with check (((created_by = auth.uid()) AND (status = 'pending'::text)));

-- public.form_documents: issue allowed documents
create policy "issue allowed documents" on public.form_documents as PERMISSIVE for INSERT to authenticated
  with check (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM form_templates t
  WHERE ((t.id = form_documents.template_id) AND t.is_active AND ((t.allowed_roles && my_form_roles()) OR is_form_manager())))) AND (status = ANY (ARRAY['pending'::text, 'issued'::text, 'awaiting_reply'::text]))));

-- public.form_documents: issuer deletes own unapproved
create policy "issuer deletes own unapproved" on public.form_documents as PERMISSIVE for DELETE to authenticated
  using (((created_by = auth.uid()) AND (status = ANY (ARRAY['awaiting_reply'::text, 'replied'::text, 'pending'::text, 'rejected'::text]))));

-- public.form_documents: issuer handles reply
create policy "issuer handles reply" on public.form_documents as PERMISSIVE for UPDATE to authenticated
  using (((created_by = auth.uid()) AND (status = ANY (ARRAY['awaiting_reply'::text, 'replied'::text, 'pending'::text, 'rejected'::text]))))
  with check ((created_by = auth.uid()));

-- public.form_documents: managers delete documents
create policy "managers delete documents" on public.form_documents as PERMISSIVE for DELETE to authenticated
  using (is_form_manager());

-- public.form_documents: read own or manage all documents
create policy "read own or manage all documents" on public.form_documents as PERMISSIVE for SELECT to authenticated
  using (((created_by = auth.uid()) OR is_form_manager() OR (recipient_user_id = auth.uid()) OR ((student_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (guardian_student gs
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = form_documents.student_id) AND (g.user_id = auth.uid())))))));

-- public.form_documents: recipient replies
create policy "recipient replies" on public.form_documents as PERMISSIVE for UPDATE to authenticated
  using (((recipient_user_id = auth.uid()) AND (status = 'awaiting_reply'::text)))
  with check (((recipient_user_id = auth.uid()) AND (status = 'replied'::text)));

-- public.form_templates: managers write templates
create policy "managers write templates" on public.form_templates as PERMISSIVE for ALL to authenticated
  using (is_form_manager())
  with check (is_form_manager());

-- public.form_templates: read allowed templates
create policy "read allowed templates" on public.form_templates as PERMISSIVE for SELECT to authenticated
  using ((is_form_manager() OR (is_active AND (allowed_roles && my_form_roles()))));

-- public.grade_entries: admin read grade_entries
create policy "admin read grade_entries" on public.grade_entries as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::user_role)))));

-- public.grade_entries: teacher manage own grade_entries
create policy "teacher manage own grade_entries" on public.grade_entries as PERMISSIVE for ALL to public
  using ((teacher_user_id = auth.uid()))
  with check ((teacher_user_id = auth.uid()));

-- public.grades_records: grades_admin_read
create policy grades_admin_read on public.grades_records as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.grades_records: grades_delete
create policy grades_delete on public.grades_records as PERMISSIVE for DELETE to authenticated
  using (has_admin_role('principal'::admin_role_type));

-- public.grades_records: grades_guardian_read
create policy grades_guardian_read on public.grades_records as PERMISSIVE for SELECT to authenticated
  using (((is_published = true) AND is_guardian_of(student_id)));

-- public.grades_records: grades_import
create policy grades_import on public.grades_records as PERMISSIVE for INSERT to authenticated
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.grades_records: grades_publish
create policy grades_publish on public.grades_records as PERMISSIVE for UPDATE to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type]));

-- public.grades_records: grades_student_read
create policy grades_student_read on public.grades_records as PERMISSIVE for SELECT to authenticated
  using (((is_published = true) AND (student_id = current_student_id())));

-- public.grades_records: grades_teacher_read
create policy grades_teacher_read on public.grades_records as PERMISSIVE for SELECT to authenticated
  using (teaches_student(student_id));

-- public.guardian_student: gs_admin_read
create policy gs_admin_read on public.guardian_student as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.guardian_student: gs_guardian_read
create policy gs_guardian_read on public.guardian_student as PERMISSIVE for SELECT to authenticated
  using ((guardian_id = current_guardian_id()));

-- public.guardian_student: gs_teacher_read
create policy gs_teacher_read on public.guardian_student as PERMISSIVE for SELECT to authenticated
  using (teaches_student(student_id));

-- public.guardian_student: gs_write
create policy gs_write on public.guardian_student as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.guardian_student: guardian_student_write
create policy guardian_student_write on public.guardian_student as PERMISSIVE for ALL to authenticated
  using (is_admin())
  with check (is_admin());

-- public.guardians: guardians_admin_read
create policy guardians_admin_read on public.guardians as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.guardians: guardians_admin_write
create policy guardians_admin_write on public.guardians as PERMISSIVE for ALL to authenticated
  using (is_admin())
  with check (is_admin());

-- public.guardians: guardians_read_self
create policy guardians_read_self on public.guardians as PERMISSIVE for SELECT to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));

-- public.guardians: guardians_update_self
create policy guardians_update_self on public.guardians as PERMISSIVE for UPDATE to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)))
  with check ((user_id = ( SELECT auth.uid() AS uid)));

-- public.guides: guides_admin_all
create policy guides_admin_all on public.guides as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))))
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.guides: guides_read
create policy guides_read on public.guides as PERMISSIVE for SELECT to public
  using (((is_published = true) AND ((audience = 'general'::text) OR (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.is_active = true) AND (((u.role)::text = 'admin'::text) OR ((u.role)::text = guides.audience))))))));

-- public.import_logs: import_read
create policy import_read on public.import_logs as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.import_logs: import_write
create policy import_write on public.import_logs as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.login_log: anyone can log a login attempt
create policy "anyone can log a login attempt" on public.login_log as PERMISSIVE for INSERT to anon, authenticated
  with check (true);

-- public.login_log: support read login log
create policy "support read login log" on public.login_log as PERMISSIVE for SELECT to authenticated
  using ((EXISTS ( SELECT 1
   FROM admin_roles ar
  WHERE ((ar.user_id = auth.uid()) AND ((ar.role_type = 'tech_support'::admin_role_type) OR (ar.role_type IN ( SELECT role_permissions.role_type
           FROM role_permissions
          WHERE (role_permissions.permission = 'login_log'::text))))))));

-- public.maintenance_state: ms_read
create policy ms_read on public.maintenance_state as PERMISSIVE for SELECT to public
  using ((auth.uid() IS NOT NULL));

-- public.maintenance_state: ms_write
create policy ms_write on public.maintenance_state as PERMISSIVE for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM (admin_roles ar
     JOIN users u ON ((u.id = ar.user_id)))
  WHERE ((ar.user_id = auth.uid()) AND (ar.role_type = 'tech_support'::admin_role_type) AND (u.is_active = true)))))
  with check ((EXISTS ( SELECT 1
   FROM (admin_roles ar
     JOIN users u ON ((u.id = ar.user_id)))
  WHERE ((ar.user_id = auth.uid()) AND (ar.role_type = 'tech_support'::admin_role_type) AND (u.is_active = true)))));

-- public.news: news_admin_all
create policy news_admin_all on public.news as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true)))))
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true)))));

-- public.news: news_public_read
create policy news_public_read on public.news as PERMISSIVE for SELECT to public
  using ((is_published = true));

-- public.notification_drafts: ndraft insert own
create policy "ndraft insert own" on public.notification_drafts as PERMISSIVE for INSERT to public
  with check ((sender_id = auth.uid()));

-- public.notification_drafts: ndraft select
create policy "ndraft select" on public.notification_drafts as PERMISSIVE for SELECT to public
  using (((sender_id = auth.uid()) OR is_tech_support()));

-- public.notification_drafts: ndraft update tech
create policy "ndraft update tech" on public.notification_drafts as PERMISSIVE for UPDATE to public
  using (is_tech_support())
  with check (is_tech_support());

-- public.notification_recipients: notif_rec_delete
create policy notif_rec_delete on public.notification_recipients as PERMISSIVE for DELETE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.notification_recipients: notif_rec_insert
create policy notif_rec_insert on public.notification_recipients as PERMISSIVE for INSERT to public
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.notification_recipients: notif_rec_read
create policy notif_rec_read on public.notification_recipients as PERMISSIVE for SELECT to public
  using (((user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true))))));

-- public.notification_recipients: notif_rec_update
create policy notif_rec_update on public.notification_recipients as PERMISSIVE for UPDATE to public
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- public.notifications: notif_admin_write
create policy notif_admin_write on public.notifications as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))))
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.notifications: notif_read
create policy notif_read on public.notifications as PERMISSIVE for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM notification_recipients r
  WHERE ((r.notification_id = notifications.id) AND (r.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true))))));

-- public.official_attendance_days: sa_days_read
create policy sa_days_read on public.official_attendance_days as PERMISSIVE for SELECT to public
  using (sa_is_staff());

-- public.official_attendance_days: sa_days_write
create policy sa_days_write on public.official_attendance_days as PERMISSIVE for ALL to public
  using (sa_can_manage())
  with check (sa_can_manage());

-- public.official_day_marks: sa_marks_read
create policy sa_marks_read on public.official_day_marks as PERMISSIVE for SELECT to public
  using (sa_is_staff());

-- public.official_day_marks: sa_marks_write
create policy sa_marks_write on public.official_day_marks as PERMISSIVE for ALL to public
  using (sa_can_manage())
  with check (sa_can_manage());

-- public.period_times: period_times_read
create policy period_times_read on public.period_times as PERMISSIVE for SELECT to public
  using (true);

-- public.period_times: period_times_write
create policy period_times_write on public.period_times as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM admin_roles
  WHERE ((admin_roles.user_id = auth.uid()) AND (admin_roles.role_type = ANY (ARRAY['principal'::admin_role_type, 'tech_support'::admin_role_type]))))))
  with check ((EXISTS ( SELECT 1
   FROM admin_roles
  WHERE ((admin_roles.user_id = auth.uid()) AND (admin_roles.role_type = ANY (ARRAY['principal'::admin_role_type, 'tech_support'::admin_role_type]))))));

-- public.permission_grantors: grantors_all
create policy grantors_all on public.permission_grantors as PERMISSIVE for ALL to public
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- public.permission_grantors: grantors_select
create policy grantors_select on public.permission_grantors as PERMISSIVE for SELECT to public
  using (true);

-- public.permission_request_students: prs_delete
create policy prs_delete on public.permission_request_students as PERMISSIVE for DELETE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.permission_request_students: prs_insert
create policy prs_insert on public.permission_request_students as PERMISSIVE for INSERT to public
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.permission_request_students: prs_select
create policy prs_select on public.permission_request_students as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = ANY (ARRAY['admin'::user_role, 'teacher'::user_role])) AND (users.is_active = true)))));

-- public.permission_requests: permission_requests_delete
create policy permission_requests_delete on public.permission_requests as PERMISSIVE for DELETE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.permission_requests: permission_requests_insert
create policy permission_requests_insert on public.permission_requests as PERMISSIVE for INSERT to public
  with check (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true))))));

-- public.permission_requests: permission_requests_select
create policy permission_requests_select on public.permission_requests as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (users.is_active = true)))));

-- public.permission_requests: permission_requests_update
create policy permission_requests_update on public.permission_requests as PERMISSIVE for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.permission_returns: preturns_delete
create policy preturns_delete on public.permission_returns as PERMISSIVE for DELETE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.permission_returns: preturns_insert
create policy preturns_insert on public.permission_returns as PERMISSIVE for INSERT to public
  with check ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.permission_returns: preturns_select
create policy preturns_select on public.permission_returns as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (users.is_active = true)))));

-- public.permission_returns: preturns_update
create policy preturns_update on public.permission_returns as PERMISSIVE for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true)))));

-- public.push_subscriptions: push own delete
create policy "push own delete" on public.push_subscriptions as PERMISSIVE for DELETE to public
  using ((auth.uid() = user_id));

-- public.push_subscriptions: push own insert
create policy "push own insert" on public.push_subscriptions as PERMISSIVE for INSERT to public
  with check ((auth.uid() = user_id));

-- public.push_subscriptions: push own select
create policy "push own select" on public.push_subscriptions as PERMISSIVE for SELECT to public
  using ((auth.uid() = user_id));

-- public.push_subscriptions: push own update
create policy "push own update" on public.push_subscriptions as PERMISSIVE for UPDATE to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));

-- public.quiz_assignments: assign read
create policy "assign read" on public.quiz_assignments as PERMISSIVE for SELECT to public
  using (((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_assignments.quiz_id) AND ((q.teacher_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_academic'::text]))))) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = quiz_assignments.student_id) AND (s.user_id = auth.uid()))))));

-- public.quiz_classes: own quiz classes
create policy "own quiz classes" on public.quiz_classes as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_classes.quiz_id) AND ((q.teacher_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_academic'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_classes.quiz_id) AND (q.teacher_id = auth.uid())))));

-- public.quiz_online: online manage
create policy "online manage" on public.quiz_online as PERMISSIVE for UPDATE to public
  using ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_online.quiz_id) AND (q.teacher_id = auth.uid())))));

-- public.quiz_online: online read
create policy "online read" on public.quiz_online as PERMISSIVE for SELECT to public
  using ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_online.quiz_id) AND ((q.teacher_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_academic'::text]))))));

-- public.quiz_questions: own questions
create policy "own questions" on public.quiz_questions as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_questions.quiz_id) AND ((q.teacher_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_academic'::text]))))))
  with check ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_questions.quiz_id) AND (q.teacher_id = auth.uid())))));

-- public.quiz_submissions: mark submissions
create policy "mark submissions" on public.quiz_submissions as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_submissions.quiz_id) AND (q.teacher_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_submissions.quiz_id) AND (q.teacher_id = auth.uid())))));

-- public.quiz_submissions: read submissions
create policy "read submissions" on public.quiz_submissions as PERMISSIVE for SELECT to authenticated
  using (((EXISTS ( SELECT 1
   FROM quizzes q
  WHERE ((q.id = quiz_submissions.quiz_id) AND ((q.teacher_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_academic'::text]))))) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = quiz_submissions.student_id) AND (s.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (guardian_student gs
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = quiz_submissions.student_id) AND (g.user_id = auth.uid()))))));

-- public.quizzes: own quizzes
create policy "own quizzes" on public.quizzes as PERMISSIVE for ALL to authenticated
  using (((teacher_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_academic'::text])))
  with check ((teacher_id = auth.uid()));

-- public.role_permissions: role_perms_read
create policy role_perms_read on public.role_permissions as PERMISSIVE for SELECT to public
  using ((auth.uid() IS NOT NULL));

-- public.role_permissions: role_perms_write
create policy role_perms_write on public.role_permissions as PERMISSIVE for ALL to public
  using ((EXISTS ( SELECT 1
   FROM admin_roles
  WHERE ((admin_roles.user_id = auth.uid()) AND (admin_roles.role_type = ANY (ARRAY['principal'::admin_role_type, 'tech_support'::admin_role_type]))))))
  with check ((EXISTS ( SELECT 1
   FROM admin_roles
  WHERE ((admin_roles.user_id = auth.uid()) AND (admin_roles.role_type = ANY (ARRAY['principal'::admin_role_type, 'tech_support'::admin_role_type]))))));

-- public.schedule: schedule_admin_write
create policy schedule_admin_write on public.schedule as PERMISSIVE for ALL to authenticated
  using (is_admin())
  with check (is_admin());

-- public.schedule: schedule_read
create policy schedule_read on public.schedule as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.school_assets: managers write school assets
create policy "managers write school assets" on public.school_assets as PERMISSIVE for ALL to authenticated
  using (is_form_manager())
  with check (is_form_manager());

-- public.school_assets: read school assets
create policy "read school assets" on public.school_assets as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.school_events: create events
create policy "create events" on public.school_events as PERMISSIVE for INSERT to authenticated
  with check ((organizer_id = auth.uid()));

-- public.school_events: delete events
create policy "delete events" on public.school_events as PERMISSIVE for DELETE to authenticated
  using ((((organizer_id = auth.uid()) AND (stage = 'draft'::text)) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text])));

-- public.school_events: read events
create policy "read events" on public.school_events as PERMISSIVE for SELECT to authenticated
  using (((organizer_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text, 'activity_leader'::text]) OR ev_is_participant(id)));

-- public.school_events: update events
create policy "update events" on public.school_events as PERMISSIVE for UPDATE to authenticated
  using (((organizer_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text])));

-- public.settings: settings_read
create policy settings_read on public.settings as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.settings: settings_write
create policy settings_write on public.settings as PERMISSIVE for ALL to authenticated
  using (has_admin_role('principal'::admin_role_type))
  with check (has_admin_role('principal'::admin_role_type));

-- public.site_status_snapshots: site monitors read snapshots
create policy "site monitors read snapshots" on public.site_status_snapshots as PERMISSIVE for SELECT to authenticated
  using (is_site_monitor());

-- public.sms_logs: sms_admin_read
create policy sms_admin_read on public.sms_logs as PERMISSIVE for SELECT to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type, 'counselor'::admin_role_type]));

-- public.sms_logs: sms_guardian_read
create policy sms_guardian_read on public.sms_logs as PERMISSIVE for SELECT to authenticated
  using ((guardian_id = current_guardian_id()));

-- public.sms_logs: sms_write
create policy sms_write on public.sms_logs as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'deputy'::admin_role_type]));

-- public.student_enrollment: enroll_admin_read
create policy enroll_admin_read on public.student_enrollment as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.student_enrollment: enroll_guardian_read
create policy enroll_guardian_read on public.student_enrollment as PERMISSIVE for SELECT to authenticated
  using (is_guardian_of(student_id));

-- public.student_enrollment: enroll_self_read
create policy enroll_self_read on public.student_enrollment as PERMISSIVE for SELECT to authenticated
  using ((student_id = current_student_id()));

-- public.student_enrollment: enroll_teacher_read
create policy enroll_teacher_read on public.student_enrollment as PERMISSIVE for SELECT to authenticated
  using (teaches_student(student_id));

-- public.student_enrollment: enroll_write
create policy enroll_write on public.student_enrollment as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.student_enrollment: student_enrollment_admin_write
create policy student_enrollment_admin_write on public.student_enrollment as PERMISSIVE for ALL to authenticated
  using (is_admin())
  with check (is_admin());

-- public.student_referrals: guardian acknowledges
create policy "guardian acknowledges" on public.student_referrals as PERMISSIVE for UPDATE to authenticated
  using (((status = 'with_guardian'::text) AND (EXISTS ( SELECT 1
   FROM (guardian_student gs
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = student_referrals.student_id) AND (g.user_id = auth.uid()))))))
  with check ((status = ANY (ARRAY['with_guardian'::text, 'guardian_replied'::text])));

-- public.student_referrals: managers delete referral
create policy "managers delete referral" on public.student_referrals as PERMISSIVE for DELETE to authenticated
  using (has_admin_role(ARRAY['principal'::text, 'tech_support'::text]));

-- public.student_referrals: read referrals
create policy "read referrals" on public.student_referrals as PERMISSIVE for SELECT to authenticated
  using (((teacher_id = auth.uid()) OR (counselor_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'counselor_1'::text, 'counselor_2'::text, 'counselor_3'::text]) OR (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = student_referrals.student_id) AND (s.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM (guardian_student gs
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = student_referrals.student_id) AND (g.user_id = auth.uid()))))));

-- public.student_referrals: staff updates referral
create policy "staff updates referral" on public.student_referrals as PERMISSIVE for UPDATE to authenticated
  using (has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'counselor_1'::text, 'counselor_2'::text, 'counselor_3'::text]));

-- public.student_referrals: teacher creates referral
create policy "teacher creates referral" on public.student_referrals as PERMISSIVE for INSERT to authenticated
  with check ((teacher_id = auth.uid()));

-- public.student_results: admin manage student_results
create policy "admin manage student_results" on public.student_results as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::user_role)))))
  with check ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::user_role)))));

-- public.student_results: guardian read children published result
create policy "guardian read children published results" on public.student_results as PERMISSIVE for SELECT to authenticated
  using (((published = true) AND (EXISTS ( SELECT 1
   FROM (guardian_student gs
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((gs.student_id = student_results.student_id) AND (g.user_id = auth.uid()))))));

-- public.student_results: student read own published results
create policy "student read own published results" on public.student_results as PERMISSIVE for SELECT to authenticated
  using (((published = true) AND (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = student_results.student_id) AND (s.user_id = auth.uid()))))));

-- public.students: students_admin_read
create policy students_admin_read on public.students as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.students: students_admin_write
create policy students_admin_write on public.students as PERMISSIVE for ALL to authenticated
  using (is_admin())
  with check (is_admin());

-- public.students: students_guardian_read
create policy students_guardian_read on public.students as PERMISSIVE for SELECT to authenticated
  using (is_guardian_of(id));

-- public.students: students_self_read
create policy students_self_read on public.students as PERMISSIVE for SELECT to authenticated
  using ((id = current_student_id()));

-- public.students: students_teacher_read
create policy students_teacher_read on public.students as PERMISSIVE for SELECT to authenticated
  using (teaches_student(id));

-- public.subject_aliases: aliases_read
create policy aliases_read on public.subject_aliases as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.subject_aliases: aliases_write
create policy aliases_write on public.subject_aliases as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.subjects: subjects_read
create policy subjects_read on public.subjects as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.subjects: subjects_write
create policy subjects_write on public.subjects as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.substitute_periods: authenticated read substitute period
create policy "authenticated read substitute periods" on public.substitute_periods as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.substitute_periods: teachers delete own substitute recor
create policy "teachers delete own substitute record today" on public.substitute_periods as PERMISSIVE for DELETE to authenticated
  using (((attend_date = ((now() AT TIME ZONE 'Asia/Riyadh'::text))::date) AND (EXISTS ( SELECT 1
   FROM teachers t
  WHERE ((t.id = substitute_periods.cover_teacher_id) AND (t.user_id = auth.uid()))))));

-- public.substitute_periods: teachers insert own substitute recor
create policy "teachers insert own substitute record" on public.substitute_periods as PERMISSIVE for INSERT to authenticated
  with check ((EXISTS ( SELECT 1
   FROM teachers t
  WHERE ((t.id = substitute_periods.cover_teacher_id) AND (t.user_id = auth.uid())))));

-- public.supervision_duty: manage supervision
create policy "manage supervision" on public.supervision_duty as PERMISSIVE for ALL to authenticated
  using (is_form_manager())
  with check (is_form_manager());

-- public.supervision_duty: read supervision
create policy "read supervision" on public.supervision_duty as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.teacher_follow_up: teacher manage own follow-up marks
create policy "teacher manage own follow-up marks" on public.teacher_follow_up as PERMISSIVE for ALL to authenticated
  using ((EXISTS ( SELECT 1
   FROM teachers t
  WHERE ((t.id = teacher_follow_up.teacher_id) AND (t.user_id = auth.uid())))))
  with check ((EXISTS ( SELECT 1
   FROM teachers t
  WHERE ((t.id = teacher_follow_up.teacher_id) AND (t.user_id = auth.uid())))));

-- public.teacher_granted_tabs: teacher_granted_tabs_admin_write
create policy teacher_granted_tabs_admin_write on public.teacher_granted_tabs as PERMISSIVE for ALL to authenticated
  using (is_admin())
  with check (is_admin());

-- public.teacher_granted_tabs: teacher_granted_tabs_read
create policy teacher_granted_tabs_read on public.teacher_granted_tabs as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.teacher_hidden_tabs: teacher_hidden_tabs_admin_write
create policy teacher_hidden_tabs_admin_write on public.teacher_hidden_tabs as PERMISSIVE for ALL to authenticated
  using (is_admin())
  with check (is_admin());

-- public.teacher_hidden_tabs: teacher_hidden_tabs_read
create policy teacher_hidden_tabs_read on public.teacher_hidden_tabs as PERMISSIVE for SELECT to authenticated
  using (true);

-- public.teachers: teachers_admin_read
create policy teachers_admin_read on public.teachers as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.teachers: teachers_read_basic
create policy teachers_read_basic on public.teachers as PERMISSIVE for SELECT to public
  using ((auth.uid() IS NOT NULL));

-- public.teachers: teachers_read_self
create policy teachers_read_self on public.teachers as PERMISSIVE for SELECT to authenticated
  using ((user_id = ( SELECT auth.uid() AS uid)));

-- public.teachers: teachers_write
create policy teachers_write on public.teachers as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.unmatched_logs: unmatched_read
create policy unmatched_read on public.unmatched_logs as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.unmatched_logs: unmatched_write
create policy unmatched_write on public.unmatched_logs as PERMISSIVE for ALL to authenticated
  using (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]))
  with check (has_any_admin_role(ARRAY['principal'::admin_role_type, 'clerk'::admin_role_type]));

-- public.user_signatures: read own signature or manage
create policy "read own signature or manage" on public.user_signatures as PERMISSIVE for SELECT to authenticated
  using (((user_id = auth.uid()) OR is_form_manager()));

-- public.user_signatures: write own signature
create policy "write own signature" on public.user_signatures as PERMISSIVE for ALL to authenticated
  using ((user_id = auth.uid()))
  with check ((user_id = auth.uid()));

-- public.users: users_admin_read
create policy users_admin_read on public.users as PERMISSIVE for SELECT to authenticated
  using (is_admin());

-- public.users: users_admin_write
create policy users_admin_write on public.users as PERMISSIVE for ALL to authenticated
  using (has_admin_role('principal'::admin_role_type))
  with check (has_admin_role('principal'::admin_role_type));

-- public.users: users_read_own
create policy users_read_own on public.users as PERMISSIVE for SELECT to public
  using ((id = auth.uid()));

-- public.users: users_read_self
create policy users_read_self on public.users as PERMISSIVE for SELECT to authenticated
  using ((id = ( SELECT auth.uid() AS uid)));

-- public.users: users_update_own
create policy users_update_own on public.users as PERMISSIVE for UPDATE to public
  using ((id = auth.uid()))
  with check ((id = auth.uid()));

-- storage.objects: admin manage results files
create policy "admin manage results files" on storage.objects as PERMISSIVE for ALL to authenticated
  using (((bucket_id = 'results'::text) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::user_role))))))
  with check (((bucket_id = 'results'::text) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::user_role))))));

-- storage.objects: event reports delete
create policy "event reports delete" on storage.objects as PERMISSIVE for DELETE to authenticated
  using (((bucket_id = 'event-reports'::text) AND (EXISTS ( SELECT 1
   FROM school_events e
  WHERE (((e.id)::text = (storage.foldername(objects.name))[1]) AND ((e.organizer_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text])))))));

-- storage.objects: event reports read
create policy "event reports read" on storage.objects as PERMISSIVE for SELECT to authenticated
  using (((bucket_id = 'event-reports'::text) AND (EXISTS ( SELECT 1
   FROM school_events e
  WHERE (((e.id)::text = (storage.foldername(objects.name))[1]) AND ((e.organizer_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text, 'deputy_academic'::text, 'activity_leader'::text])))))));

-- storage.objects: event reports write
create policy "event reports write" on storage.objects as PERMISSIVE for INSERT to authenticated
  with check (((bucket_id = 'event-reports'::text) AND (EXISTS ( SELECT 1
   FROM school_events e
  WHERE (((e.id)::text = (storage.foldername(objects.name))[1]) AND ((e.organizer_id = auth.uid()) OR has_admin_role(ARRAY['principal'::text, 'tech_support'::text, 'deputy_students'::text])))))));

-- storage.objects: guides_files_delete
create policy guides_files_delete on storage.objects as PERMISSIVE for DELETE to public
  using (((bucket_id = 'guides'::text) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true))))));

-- storage.objects: guides_files_read
create policy guides_files_read on storage.objects as PERMISSIVE for SELECT to public
  using ((bucket_id = 'guides'::text));

-- storage.objects: guides_files_write
create policy guides_files_write on storage.objects as PERMISSIVE for INSERT to public
  with check (((bucket_id = 'guides'::text) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND ((users.role)::text = 'admin'::text) AND (users.is_active = true))))));

-- storage.objects: managers write school files
create policy "managers write school files" on storage.objects as PERMISSIVE for ALL to authenticated
  using (((bucket_id = 'form-assets'::text) AND ((storage.foldername(name))[1] = 'school'::text) AND is_form_manager()))
  with check (((bucket_id = 'form-assets'::text) AND ((storage.foldername(name))[1] = 'school'::text) AND is_form_manager()));

-- storage.objects: news_images_delete
create policy news_images_delete on storage.objects as PERMISSIVE for DELETE to public
  using (((bucket_id = 'news'::text) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true))))));

-- storage.objects: news_images_read
create policy news_images_read on storage.objects as PERMISSIVE for SELECT to public
  using ((bucket_id = 'news'::text));

-- storage.objects: news_images_write
create policy news_images_write on storage.objects as PERMISSIVE for INSERT to public
  with check (((bucket_id = 'news'::text) AND (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::user_role) AND (users.is_active = true))))));

-- storage.objects: notif img read
create policy "notif img read" on storage.objects as PERMISSIVE for SELECT to public
  using ((bucket_id = 'notification-images'::text));

-- storage.objects: notif img upload
create policy "notif img upload" on storage.objects as PERMISSIVE for INSERT to authenticated
  with check ((bucket_id = 'notification-images'::text));

-- storage.objects: own signature files
create policy "own signature files" on storage.objects as PERMISSIVE for ALL to authenticated
  using (((bucket_id = 'form-assets'::text) AND ((storage.foldername(name))[1] = 'signatures'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)))
  with check (((bucket_id = 'form-assets'::text) AND ((storage.foldername(name))[1] = 'signatures'::text) AND ((storage.foldername(name))[2] = (auth.uid())::text)));

-- storage.objects: public read ticket attachments
create policy "public read ticket attachments" on storage.objects as PERMISSIVE for SELECT to public
  using ((bucket_id = 'ticket-attachments'::text));

-- storage.objects: quiz images delete
create policy "quiz images delete" on storage.objects as PERMISSIVE for DELETE to authenticated
  using (((bucket_id = 'quiz-images'::text) AND (EXISTS ( SELECT 1
   FROM quizzes q
  WHERE (((q.id)::text = (storage.foldername(objects.name))[1]) AND (q.teacher_id = auth.uid()))))));

-- storage.objects: quiz images read
create policy "quiz images read" on storage.objects as PERMISSIVE for SELECT to authenticated
  using (((bucket_id = 'quiz-images'::text) AND (EXISTS ( SELECT 1
   FROM quizzes q
  WHERE (((q.id)::text = (storage.foldername(objects.name))[1]) AND (q.teacher_id = auth.uid()))))));

-- storage.objects: quiz images write
create policy "quiz images write" on storage.objects as PERMISSIVE for INSERT to authenticated
  with check (((bucket_id = 'quiz-images'::text) AND (EXISTS ( SELECT 1
   FROM quizzes q
  WHERE (((q.id)::text = (storage.foldername(objects.name))[1]) AND (q.teacher_id = auth.uid()))))));

-- storage.objects: read form assets
create policy "read form assets" on storage.objects as PERMISSIVE for SELECT to authenticated
  using (((bucket_id = 'form-assets'::text) AND (((storage.foldername(name))[1] = 'school'::text) OR is_form_manager() OR ((storage.foldername(name))[2] = (auth.uid())::text))));

-- storage.objects: student and guardian read own results files
create policy "student and guardian read own results files" on storage.objects as PERMISSIVE for SELECT to authenticated
  using ((((bucket_id = 'results'::text) AND (EXISTS ( SELECT 1
   FROM (student_results r
     JOIN students s ON ((s.id = r.student_id)))
  WHERE ((r.file_path = objects.name) AND (r.published = true) AND (s.user_id = auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM ((student_results r
     JOIN guardian_student gs ON ((gs.student_id = r.student_id)))
     JOIN guardians g ON ((g.id = gs.guardian_id)))
  WHERE ((r.file_path = objects.name) AND (r.published = true) AND (g.user_id = auth.uid()))))));

-- storage.objects: support upload any ticket attachment
create policy "support upload any ticket attachment" on storage.objects as PERMISSIVE for INSERT to authenticated
  with check (((bucket_id = 'ticket-attachments'::text) AND (EXISTS ( SELECT 1
   FROM admin_roles ar
  WHERE ((ar.user_id = auth.uid()) AND ((ar.role_type = 'tech_support'::admin_role_type) OR (ar.role_type IN ( SELECT role_permissions.role_type
           FROM role_permissions
          WHERE (role_permissions.permission = 'feedback'::text)))))))));

-- storage.objects: user upload own ticket attachment
create policy "user upload own ticket attachment" on storage.objects as PERMISSIVE for INSERT to authenticated
  with check (((bucket_id = 'ticket-attachments'::text) AND (EXISTS ( SELECT 1
   FROM feedback f
  WHERE (((f.id)::text = (storage.foldername(objects.name))[1]) AND (f.user_id = auth.uid()))))));


-- ---------------------------------------------------------------------
--  9) المشغّلات (triggers) — 14
-- ---------------------------------------------------------------------

-- class_attendance.ca_block_early_marking
CREATE TRIGGER ca_block_early_marking BEFORE INSERT OR UPDATE ON public.class_attendance FOR EACH ROW EXECUTE FUNCTION ca_block_early_marking();

-- class_attendance.trg_notify_absence
CREATE TRIGGER trg_notify_absence AFTER INSERT OR UPDATE ON public.class_attendance FOR EACH ROW EXECUTE FUNCTION notify_absence();

-- class_attendance.trg_notify_official_absence
CREATE TRIGGER trg_notify_official_absence AFTER INSERT OR UPDATE ON public.class_attendance FOR EACH ROW EXECUTE FUNCTION notify_official_absence();

-- daily_attendance.trg_notify_morning_tardy
CREATE TRIGGER trg_notify_morning_tardy AFTER INSERT ON public.daily_attendance FOR EACH ROW EXECUTE FUNCTION notify_morning_tardy();

-- form_documents.fd_guard_self_issue
CREATE TRIGGER fd_guard_self_issue BEFORE INSERT OR UPDATE ON public.form_documents FOR EACH ROW EXECUTE FUNCTION fd_guard_self_issue();

-- form_documents.fd_guard_template_use
CREATE TRIGGER fd_guard_template_use BEFORE INSERT ON public.form_documents FOR EACH ROW EXECUTE FUNCTION fd_guard_template_use();

-- form_documents.trg_sync_event_consent
CREATE TRIGGER trg_sync_event_consent AFTER UPDATE ON public.form_documents FOR EACH ROW EXECUTE FUNCTION sync_event_consent();

-- guides.trg_guides_updated_at
CREATE TRIGGER trg_guides_updated_at BEFORE UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION touch_guides_updated_at();

-- login_log.trg_trim_login_log
CREATE TRIGGER trg_trim_login_log AFTER INSERT ON public.login_log FOR EACH ROW EXECUTE FUNCTION trim_login_log();

-- news.trg_news_updated_at
CREATE TRIGGER trg_news_updated_at BEFORE UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION touch_news_updated_at();

-- news.trg_notify_news
CREATE TRIGGER trg_notify_news AFTER INSERT OR UPDATE ON public.news FOR EACH ROW EXECUTE FUNCTION notify_news();

-- permission_request_students.trg_notify_permission
CREATE TRIGGER trg_notify_permission AFTER INSERT ON public.permission_request_students FOR EACH ROW EXECUTE FUNCTION notify_permission();

-- quiz_questions.trg_guard_quiz_limits
CREATE TRIGGER trg_guard_quiz_limits BEFORE INSERT OR UPDATE ON public.quiz_questions FOR EACH ROW EXECUTE FUNCTION guard_quiz_limits();

-- teachers.trg_hide_reports_for_new_teacher
CREATE TRIGGER trg_hide_reports_for_new_teacher AFTER INSERT ON public.teachers FOR EACH ROW EXECUTE FUNCTION hide_reports_for_new_teacher();
