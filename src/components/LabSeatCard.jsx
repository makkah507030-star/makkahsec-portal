// src/components/LabSeatCard.jsx
// بطاقة صفحة الطالب: جهازه في معمل الحاسب الآلي من خريطة الجلوس.
// لا تظهر إلا إذا وزّعه معلمه على جهاز.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEVICE_STATUS } from "../lib/lab.js";

export default function LabSeatCard() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    supabase.rpc("lab_my_seat").then(({ data }) => setRows(data ?? []), () => {});
  }, []);

  if (!rows.length) return null;

  return (
    <section className="card flex flex-wrap items-center gap-3 px-4 py-3">
      {rows.map((r) => (
        <div key={r.lab_name} className="flex items-center gap-3">
          <span className="num grid h-11 w-11 shrink-0 place-items-center rounded-sm2 bg-mint-tint text-lg font-bold text-mint-deep">{r.seat_no}</span>
          <div>
            <p className="text-sm font-semibold text-ink">جهازك في {r.lab_name}</p>
            <p className="text-xs text-muted">
              الجهاز رقم <bdi className="num">{r.seat_no}</bdi> · <bdi dir="ltr">{r.code}</bdi>
              {r.status && r.status !== "ok" && <> · {DEVICE_STATUS[r.status]?.label} — راجع معلمك</>}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
