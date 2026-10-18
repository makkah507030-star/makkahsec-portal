// src/pages/lab/LabWallpapers.jsx
// مولّد خلفيات سطح المكتب لأجهزة المعمل: لكل جهاز صورة برقمه ورمز QR للإبلاغ
// عن عطل فيه، تُثبَّت على الجهاز ولا يغيّرها الطالب (تعليمات القفل أدناه).
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { WALLPAPER_SIZES, drawWallpaper, downloadCanvas } from "../../lib/labWallpaper.js";
import { printStickers, printReportPoster } from "../../lib/labPrint.js";

const DEFAULT_NOTE = "حافظ على جهازك · لا تغيّر إعداداته · أطفئه بعد الاستخدام";

export default function LabWallpapers({ lab, devices }) {
  const [labName, setLabName] = useState("معمل الحاسب الآلي");
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState(0);
  const [note, setNote] = useState(DEFAULT_NOTE);
  const [seat, setSeat] = useState(devices[0]?.seat_no ?? 1);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [, setMsg] = useNotice(null);

  const opts = { ...WALLPAPER_SIZES[size], labName, note };
  const popupBlocked = () => setMsg({ ok: false, text: "اسمح للمتصفح بفتح النوافذ المنبثقة لهذه الصفحة ثم أعد المحاولة." });
  const fileName = (d) => `wallpaper-${d.code}-${opts.w}x${opts.h}.png`;
  const device = devices.find((d) => d.seat_no === Number(seat)) ?? devices[0];

  useEffect(() => {
    supabase.from("labs").select("name").eq("id", lab).maybeSingle().then(({ data }) => data?.name && setLabName(data.name));
  }, [lab]);

  useEffect(() => {
    if (!open || !device) return;
    let alive = true;
    drawWallpaper(device, opts).then((c) => alive && setPreview(c.toDataURL("image/png")));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device, size, note, labName]);

  const downloadOne = async () => {
    setBusy("one");
    await downloadCanvas(await drawWallpaper(device, opts), fileName(device));
    setBusy("");
  };

  // تنزيل متتابع بمهلة قصيرة — بعض المتصفحات تطلب السماح بتنزيل ملفات متعددة مرة واحدة
  const downloadAll = async () => {
    setBusy("all");
    for (const d of devices) {
      await downloadCanvas(await drawWallpaper(d, opts), fileName(d));
      await new Promise((r) => setTimeout(r, 350));
    }
    setBusy("");
    setMsg({ ok: true, text: `نُزّلت ${devices.length} خلفية` });
  };

  return (
    <div className="card overflow-hidden print:hidden">
      <button type="button" onClick={() => setOpen(!open)}
              className="flex w-full items-center justify-between px-4 py-3 text-start">
        <span>
          <span className="block text-sm font-semibold text-ink">رموز البلاغ: خلفيات سطح المكتب والملصقات</span>
          <span className="block text-xs text-muted">رمز QR لكل جهاز يفتح بلاغ العطل عنه — على الشاشة، وملصقًا لحين لا يعمل الجهاز</span>
        </span>
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-line/60 p-4 lg:grid-cols-[1fr_18rem]">
          <div>
            {preview
              ? <img src={preview} alt={`خلفية ${device?.code}`} className="w-full rounded-sm2 border border-line shadow-card" />
              : <div className="aspect-video w-full animate-pulse rounded-sm2 bg-canvas" />}
            <p className="mt-1.5 text-center text-[11px] text-muted">معاينة {device?.code} — أيقونات سطح المكتب تبقى في الجهة اليسرى</p>
          </div>
          <div className="space-y-3">
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
            <button type="button" className="btn-ghost w-full" disabled={!!busy} onClick={downloadOne}>
              {busy === "one" ? "جارٍ التجهيز…" : `تنزيل خلفية ${device?.code}`}
            </button>
            <button type="button" className="btn-primary w-full" disabled={!!busy} onClick={downloadAll}>
              {busy === "all" ? "جارٍ التنزيل…" : `تنزيل خلفيات كل الأجهزة (${devices.length})`}
            </button>
            <div className="space-y-2 border-t border-line/60 pt-3">
              <p className="text-xs text-muted">إن لم يقلع الجهاز أو لم يصل لسطح المكتب:</p>
              <button type="button" className="btn-ghost w-full" onClick={async () => (await printStickers(devices, labName)) || popupBlocked()}>
                طباعة ملصقات الأجهزة (ورقة A4)
              </button>
              <button type="button" className="btn-ghost w-full" onClick={async () => (await printReportPoster(labName)) || popupBlocked()}>
                طباعة لوحة البلاغ العامة للمعمل
              </button>
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
    </div>
  );
}
