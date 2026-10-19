// src/pages/lab/LabWallpapers.jsx
// رموز البلاغ بهوية البوابة: خلفية سطح مكتب لكل جهاز برقمه ورمز QR يفتح بلاغه،
// وملصقات الأجهزة ولوحة البلاغ العامة لحين لا يصل الجهاز لسطح المكتب.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import Scaled from "../studio/Scaled.jsx";
import { downloadNode } from "../studio/lib";
import { WALLPAPER_SIZES, reportUrl } from "../../lib/lab.js";
import { WallpaperSheet, StickersSheet, PosterSheet, useQrCodes } from "./LabSheets.jsx";
import LabPrintDialog from "./LabPrintDialog.jsx";

const DEFAULT_NOTE = "حافظ على جهازك · لا تغيّر إعداداته · أطفئه بعد الاستخدام";
const pill = (on) =>
  `rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`;

export default function LabWallpapers({ lab, devices }) {
  const [labName, setLabName] = useState("معمل الحاسب الآلي");
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [seat, setSeat] = useState(devices[0]?.seat_no ?? 1);
  const [exporting, setExporting] = useState(null);   // الأجهزة الجاري تنزيل خلفياتها
  const [dialog, setDialog] = useState(null);         // "stickers" | "poster"
  const offRef = useRef(null);
  const [, setMsg] = useNotice(null);

  useEffect(() => {
    supabase.from("labs").select("name").eq("id", lab).maybeSingle().then(({ data }) => data?.name && setLabName(data.name));
  }, [lab]);

  const urls = [...devices.map((d) => reportUrl(d.seat_no)), reportUrl(0)];
  const codes = useQrCodes(open ? urls : [], 520);
  const { w, h } = WALLPAPER_SIZES[size];
  const device = devices.find((d) => d.seat_no === Number(seat)) ?? devices[0];
  const fileOf = (d) => `خلفية-${d.code}-${w}x${h}.png`;

  // تُرسم الخلفيات المطلوبة خارج الشاشة بمقاسها الحقيقي، ثم تُنزَّل واحدة بعد أخرى
  useEffect(() => {
    if (!exporting) return;
    let alive = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 300));
      const nodes = offRef.current?.querySelectorAll(".lab-wall") ?? [];
      for (let i = 0; i < nodes.length && alive; i++) {
        await downloadNode(nodes[i], fileOf(exporting[i]), 1);
        await new Promise((r) => setTimeout(r, 300));
      }
      if (alive) {
        if (exporting.length > 1) setMsg({ ok: true, text: `نُزّلت ${exporting.length} خلفية` });
        setExporting(null);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exporting]);

  const wallProps = (d) => ({ theme, w, h, device: d, labName, note, qr: codes[reportUrl(d.seat_no)] });

  return (
    <div className="card overflow-hidden print:hidden">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-4 py-3 text-start">
        <span>
          <span className="block text-sm font-semibold text-ink">رموز البلاغ: خلفيات سطح المكتب والملصقات</span>
          <span className="block text-xs text-muted">رمز QR لكل جهاز يفتح بلاغ العطل عنه — على الشاشة، وملصقًا لحين لا يعمل الجهاز</span>
        </span>
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-line/60 p-4 lg:grid-cols-[1fr_18rem]">
          <div>
            {device && (
              <div className="pointer-events-none">
                <Scaled w={w} h={h}><WallpaperSheet {...wallProps(device)} /></Scaled>
              </div>
            )}
            <p className="mt-1.5 text-center text-[11px] text-muted">معاينة {device?.code} — أيقونات سطح المكتب تبقى في الجهة اليسرى</p>
          </div>
          <div className="space-y-3">
            <div>
              <p className="label">النسخة</p>
              <div className="flex gap-1.5">
                <button type="button" className={pill(theme === "dark")} onClick={() => setTheme("dark")}>غامقة</button>
                <button type="button" className={pill(theme === "light")} onClick={() => setTheme("light")}>فاتحة</button>
              </div>
            </div>
            <div>
              <label className="label" htmlFor="wp-size">دقة شاشة أجهزة المعمل</label>
              <select id="wp-size" className="field" value={size} onChange={(e) => setSize(Number(e.target.value))}>
                {WALLPAPER_SIZES.map((z, i) => <option key={z.label} value={i}>{z.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="wp-seat">معاينة الجهاز</label>
              <select id="wp-seat" className="field" value={seat} onChange={(e) => setSeat(e.target.value)}>
                {devices.map((d) => <option key={d.seat_no} value={d.seat_no}>{d.seat_no} · {d.code}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="wp-note">سطر التعليمات (اختياري)</label>
              <input id="wp-note" className="field" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button type="button" className="btn-ghost w-full" disabled={!!exporting || !device} onClick={() => setExporting([device])}>
              {exporting?.length === 1 ? "جارٍ التجهيز…" : `تنزيل خلفية ${device?.code ?? ""}`}
            </button>
            <button type="button" className="btn-primary w-full" disabled={!!exporting} onClick={() => setExporting(devices)}>
              {exporting?.length > 1 ? "جارٍ التنزيل…" : `تنزيل خلفيات كل الأجهزة (${devices.length})`}
            </button>

            <div className="space-y-2 border-t border-line/60 pt-3">
              <p className="text-xs text-muted">إن لم يقلع الجهاز أو لم يصل لسطح المكتب:</p>
              <button type="button" className="btn-ghost w-full" onClick={() => setDialog("stickers")}>ملصقات الأجهزة (ورقة A4)</button>
              <button type="button" className="btn-ghost w-full" onClick={() => setDialog("poster")}>لوحة البلاغ العامة للمعمل</button>
            </div>

            <details className="rounded-sm2 bg-canvas px-3 py-2 text-xs text-muted">
              <summary className="cursor-pointer font-semibold text-ink">قفل الخلفية حتى لا يغيّرها الطالب</summary>
              <ol className="mt-2 list-decimal space-y-1 ps-4 leading-relaxed">
                <li>انسخ صورة الجهاز إلى مجلد ثابت فيه، مثل <bdi dir="ltr">C:\Lab\wallpaper.png</bdi>.</li>
                <li>افتح <bdi dir="ltr">gpedit.msc</bdi> ← User Configuration ← Administrative Templates ← Desktop ← Desktop.</li>
                <li>فعّل <bdi dir="ltr">Desktop Wallpaper</bdi> واكتب مسار الصورة.</li>
                <li>ومن Control Panel ← Personalization فعّل <bdi dir="ltr">Prevent changing desktop background</bdi>.</li>
                <li>اجعل حساب الطالب في Windows حسابًا عاديًا لا مسؤولًا (Standard user).</li>
              </ol>
            </details>
          </div>
        </div>
      )}

      {exporting && (
        <div ref={offRef} aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, pointerEvents: "none" }}>
          {exporting.map((d) => <WallpaperSheet key={d.seat_no} {...wallProps(d)} />)}
        </div>
      )}

      {dialog === "stickers" && (
        <LabPrintDialog title="ملصقات أجهزة المعمل" fileName={`ملصقات-${labName}`} onClose={() => setDialog(null)}
                        render={(th) => <StickersSheet theme={th} devices={devices} labName={labName} codes={codes} />} />
      )}
      {dialog === "poster" && (
        <LabPrintDialog title="لوحة البلاغ العامة" fileName={`لوحة-البلاغ-${labName}`} onClose={() => setDialog(null)}
                        render={(th) => <PosterSheet theme={th} labName={labName} qr={codes[reportUrl(0)]} />} />
      )}
    </div>
  );
}
