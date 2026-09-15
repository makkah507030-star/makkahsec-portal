import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/session.jsx";
import PermissionLog from "../components/PermissionLog.jsx";

const GRADES = [1, 2, 3];
const MAX_PERIODS = 7; // أقصى عدد حصص باليوم (الأحد/الاثنين = 7)

export default function PermissionRequestPage() {
  const { profile, hasAdminRole } = useSession();

  const [allowed, setAllowed] = useState(null); // null = يتحقق, true/false بعدها
  const [grantorTitle, setGrantorTitle] = useState("");

  const [grade, setGrade] = useState(1);
  const [classNo, setClassNo] = useState(null);
  const [classOptions, setClassOptions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [search, setSearch] = useState("");

  const [requestDate, setRequestDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [scope, setScope] = useState("day"); // day | periods
  const [selectedPeriods, setSelectedPeriods] = useState(new Set());
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok: bool, message: string }
  const [tab, setTab] = useState("new");

  // تحقق من الصلاحية: إدارة أو معلم مخوّل (grantor نشط)
  useEffect(() => {
    (async () => {
      if (!profile) return;
      setAllowed(profile.role === "admin");
    })();
  }, [profile]);

  // جلب أرقام الفصول المتاحة للصف المختار
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("v_active_students")
        .select("class_no")
        .eq("grade", grade)
        .order("class_no");
      const unique = Array.from(new Set((data ?? []).map((r) => r.class_no)));
      setClassOptions(unique);
      setClassNo(unique[0] ?? null);
    })();
  }, [grade]);

  // جلب طلاب الفصل المختار
  useEffect(() => {
    if (classNo == null) {
      setStudents([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("v_active_students")
        .select("student_id, full_name, national_id")
        .eq("grade", grade)
        .eq("class_no", classNo)
        .order("full_name");
      setStudents(data ?? []);
    })();
  }, [grade, classNo]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim();
    return students.filter(
      (s) => s.full_name?.includes(q) || s.national_id?.includes(q)
    );
  }, [students, search]);

  const toggleStudent = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const togglePeriod = (n) => {
    setSelectedPeriods((prev) => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  };

  const canSubmit =
    selectedIds.size > 0 &&
    requestDate &&
    (scope === "day" || selectedPeriods.size > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);

    const { data: req, error: reqErr } = await supabase
      .from("permission_requests")
      .insert({
        request_date: requestDate,
        scope,
        period_numbers:
          scope === "periods" ? Array.from(selectedPeriods).sort() : null,
        note: note.trim() || null,
        created_by: profile.id,
      })
      .select("id")
      .single();

    if (reqErr) {
      setSubmitting(false);
      setResult({ ok: false, message: "تعذّر إنشاء الطلب: " + reqErr.message });
      return;
    }

    const rows = Array.from(selectedIds).map((student_id) => ({
      request_id: req.id,
      student_id,
    }));

    const { error: linkErr } = await supabase
      .from("permission_request_students")
      .insert(rows);

    setSubmitting(false);

    if (linkErr) {
      setResult({ ok: false, message: "تعذّر ربط الطلاب: " + linkErr.message });
      return;
    }

    setResult({ ok: true, message: `تم رفع الاستئذان لـ ${rows.length} طالب.` });
    setSelectedIds(new Set());
    setNote("");
    setSelectedPeriods(new Set());
  };

  if (allowed === null) {
    return <p className="p-6 text-sm text-faint">جارِ التحقق من الصلاحية...</p>;
  }

  if (allowed === false) {
    return (
      <div className="rounded-2xl border border-line bg-white p-6 text-sm text-faint">
        رفع الاستئذان متاح للإدارة المدرسية فقط.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">الاستئذان الداخلي</h1>
        {grantorTitle && (
          <p className="text-xs text-faint">بصفتك: {grantorTitle}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setTab("new")}
          className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "new" ? "bg-mint-deep text-white"
                          : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
          رفع استئذان
        </button>
        <button onClick={() => setTab("log")}
          className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
            tab === "log" ? "bg-mint-deep text-white"
                          : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
          السجل
        </button>
      </div>

      {tab === "log" && <PermissionLog />}

      {tab === "new" && (
      <div className="space-y-5">

      {/* اختيار الصف والفصل */}
      <div className="flex flex-wrap gap-3">
        <select
          value={grade}
          onChange={(e) => setGrade(Number(e.target.value))}
          className="rounded-sm2 border border-line px-3 py-2 text-sm"
        >
          {GRADES.map((g) => (
            <option key={g} value={g}>
              الصف {g}
            </option>
          ))}
        </select>

        <select
          value={classNo ?? ""}
          onChange={(e) => setClassNo(Number(e.target.value))}
          className="rounded-sm2 border border-line px-3 py-2 text-sm"
        >
          {classOptions.map((c) => (
            <option key={c} value={c}>
              فصل {c}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="بحث بالاسم أو رقم الهوية"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-[180px] flex-1 rounded-sm2 border border-line px-3 py-2 text-sm"
        />
      </div>

      {/* قائمة الطلاب */}
      <div className="max-h-72 overflow-y-auto rounded-sm2 border border-line">
        {filteredStudents.length === 0 && (
          <p className="p-4 text-sm text-faint">لا يوجد طلاب مطابقين.</p>
        )}
        {filteredStudents.map((s) => (
          <label
            key={s.student_id}
            className="flex cursor-pointer items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0 hover:bg-mint-tint"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(s.student_id)}
              onChange={() => toggleStudent(s.student_id)}
            />
            <span className="flex-1">{s.full_name}</span>
            <span className="text-xs text-faint">{s.national_id}</span>
          </label>
        ))}
      </div>

      <p className="text-xs text-faint">
        عدد الطلاب المختارين: {selectedIds.size}
      </p>

      {/* التاريخ */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-ink">التاريخ:</label>
        <input
          type="date"
          value={requestDate}
          onChange={(e) => setRequestDate(e.target.value)}
          className="rounded-sm2 border border-line px-3 py-2 text-sm"
        />
      </div>

      {/* النطاق: يوم كامل أو حصص محددة */}
      <div className="space-y-2">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={scope === "day"}
              onChange={() => setScope("day")}
            />
            اليوم كاملاً
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={scope === "periods"}
              onChange={() => setScope("periods")}
            />
            حصص محددة
          </label>
        </div>

        {scope === "periods" && (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: MAX_PERIODS }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => togglePeriod(n)}
                className={`rounded-sm2 border px-3 py-1.5 text-sm ${
                  selectedPeriods.has(n)
                    ? "border-mint-deep bg-mint-deep text-white"
                    : "border-line text-ink"
                }`}
              >
                حصة {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ملاحظة */}
      <div>
        <label className="text-sm font-medium text-ink">ملاحظة (اختياري)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="مثال: فريق الكشافة - معسكر خارجي"
          className="mt-1 w-full rounded-sm2 border border-line px-3 py-2 text-sm"
        />
      </div>

      {result && (
        <p
          className={`text-sm ${
            result.ok ? "text-mint-deep" : "text-[#A23B3B]"
          }`}
        >
          {result.message}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="rounded-sm2 bg-mint-deep px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {submitting ? "جارِ الإرسال..." : "رفع الاستئذان"}
      </button>
      </div>
      )}
    </div>
  );
}
