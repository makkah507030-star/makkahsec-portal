import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function Dashboard() {
  const [s, setS] = useState(null);

  useEffect(() => {
    (async () => {
      const [students, classes, devices, unmatched, lastImport, noDevice] =
        await Promise.all([
          supabase.from("students").select("id", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("classes").select("id", { count: "exact", head: true }),
          supabase.from("devices").select("serial_no, label, last_seen, is_active"),
          supabase.from("unmatched_logs").select("id", { count: "exact", head: true }).eq("resolved", false),
          supabase.from("import_logs").select("import_type, status, started_at").order("started_at", { ascending: false }).limit(1),
          supabase.from("v_students_without_device").select("id", { count: "exact", head: true }),
        ]);

      setS({
        students: students.count ?? 0,
        classes: classes.count ?? 0,
        devices: devices.data ?? [],
        unmatched: unmatched.count ?? 0,
        lastImport: lastImport.data?.[0] ?? null,
        noDevice: noDevice.count ?? 0,
      });
    })();
  }, []);

  if (!s) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold">الرئيسية</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="الطلاب" value={s.students} />
        <Card label="الفصول" value={s.classes} />
        <Card label="بلا ربط بصمة" value={s.noDevice} warn={s.noDevice > 0} />
        <Card label="سجلات غير مطابقة" value={s.unmatched} warn={s.unmatched > 0} />
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">
          أجهزة البصمة
        </h2>
        {s.devices.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">لم تُسجَّل أجهزة بعد.</p>
        ) : (
          s.devices.map((d) => (
            <div
              key={d.serial_no}
              className="flex items-center justify-between border-b border-line px-4 py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.label ?? d.serial_no}</p>
                <p className="num truncate text-xs text-muted">{d.serial_no}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  d.last_seen
                    ? "bg-present/10 text-present"
                    : "bg-late/10 text-late"
                }`}
              >
                {d.last_seen
                  ? new Date(d.last_seen).toLocaleString("ar-SA")
                  : "لم يتصل بعد"}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold">آخر استيراد</h2>
        {s.lastImport ? (
          <p className="text-sm text-muted">
            {s.lastImport.import_type} —{" "}
            {new Date(s.lastImport.started_at).toLocaleString("ar-SA")} (
            {s.lastImport.status})
          </p>
        ) : (
          <p className="text-sm text-muted">لم يُنفَّذ استيراد بعد.</p>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, warn }) {
  return (
    <div className="card p-4">
      <p className={`num text-2xl font-bold ${warn ? "text-late" : "text-ink"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-sm text-muted">{label}</p>
    </div>
  );
}
