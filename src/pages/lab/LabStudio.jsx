// src/pages/lab/LabStudio.jsx
// استوديو المعمل: تصميم مطبوعات المعمل وخلفياته بهوية البوابة، من قوالب جاهزة تُعدَّل نصوصها.
// • اللوحات الإرشادية: قواعد السلامة، وتشغيل الجهاز، وآداب المعمل، والإخلاء، والأمن الرقمي، وحفظ الملفات،
//   ولوحة البلاغ، ولوحة حرة. • بطاقات الأجهزة: بطاقة كبيرة (4 في الورقة) وملصقات صغيرة (24 في الورقة).
// • خلفيات سطح المكتب: رقم الجهاز ورمز بلاغه، مع بنود تعليمات اختيارية في وسط الشاشة.
// كل ورقة بنسخها الثلاث (فاتحة وغامقة ورسمية)، وتُطبع أو تُحفظ PDF أو PNG. التعديلات تُحفظ في هذا المتصفح.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import Scaled from "../studio/Scaled.jsx";
import { downloadNode } from "../studio/lib";
import { ICONS } from "../studio/Sheets.jsx";
import { WALLPAPER_SIZES, reportUrl } from "../../lib/lab.js";
import { BoardSheet, DeviceCardsSheet, StickersSheet, PosterSheet, TipsWallSheet, useQrCodes } from "./LabSheets.jsx";
import LabPrintDialog from "./LabPrintDialog.jsx";

/* القوالب الجاهزة للوحات الإرشادية — تُعدَّل كلها قبل الطباعة */
const BOARDS = [
  { key: "rules", t: "قواعد السلامة والتعليمات", icon: "shield", sub: "", fromRules: true,
    note: "أقرّ كل طالب بقراءة هذه القواعد والالتزام بها عبر بوابة المدرسة.", items: [] },
  { key: "start", t: "تشغيل الجهاز وإيقافه", icon: "monitor", layout: "steps", sub: "خطوات بداية الحصة ونهايتها",
    items: ["اجلس على الجهاز المخصص لك في خريطة الجلوس.", "شغّل الجهاز من زر التشغيل مرة واحدة وانتظر ظهور سطح المكتب.",
      "سجّل الدخول بحساب الطالب، ولا تستخدم حساب غيرك.", "افتح البرنامج الذي يحدده المعلم فقط.",
      "احفظ عملك في المجلد المحدد قبل نهاية الحصة.", "أغلق البرامج، ثم اختر «إيقاف التشغيل» من قائمة ابدأ.",
      "رتّب لوحة المفاتيح والفأرة والكرسي قبل الخروج."] },
  { key: "manners", t: "آداب استخدام المعمل", icon: "star", sub: "",
    items: ["لا طعام ولا شراب داخل المعمل.", "حافظ على هدوء المعمل ونظافته.", "لا تغيّر إعدادات الجهاز أو خلفيته.",
      "لا تنزّل برامج أو ملفات دون إذن المعلم.", "أبلغ المعلم فورًا عن أي عطل أو ضرر.", "لا تنقل الأجهزة أو الأسلاك من أماكنها.",
      "استخدم الإنترنت للأغراض التعليمية فقط.", "احترم أجهزة زملائك وملفاتهم."] },
  { key: "evac", t: "خطة الإخلاء والطوارئ", icon: "exit", layout: "steps", sub: "عند سماع جرس الإنذار",
    items: ["توقّف عن العمل فورًا واترك أغراضك.", "لا تُطفئ الأجهزة ولا تتأخر لحفظ الملفات.",
      "اخرج بهدوء في صف واحد خلف المعلم من أقرب مخرج.", "لا تستخدم المصعد، واستخدم الدرج.",
      "توجّه إلى نقطة التجمع المحددة وابقَ مع فصلك.", "لا تعد إلى المعمل إلا بإذن."] },
  { key: "cyber", t: "الأمن الرقمي", icon: "shield", sub: "حماية حسابك وبياناتك",
    items: ["لا تشارك كلمة المرور مع أحد.", "سجّل الخروج من حساباتك قبل مغادرة الجهاز.", "لا تفتح روابط أو مرفقات مجهولة المصدر.",
      "لا تحفظ كلمات المرور في المتصفح على أجهزة المعمل.", "لا تنشر بياناتك أو صور زملائك.", "أبلغ المعلم عن أي رسالة مريبة أو ابتزاز."] },
  { key: "files", t: "حفظ الملفات وتسليم العمل", icon: "send", layout: "steps", sub: "",
    items: ["احفظ عملك باسمك ورقم فصلك، مثل: محمد-1-3.", "احفظ في المجلد الذي يحدده المعلم لا على سطح المكتب.",
      "احفظ كل خمس دقائق بالضغط على Ctrl + S.", "سلّم عملك من منصة مدرستي أو كما يحدد المعلم.", "لا تحذف ملفات غيرك ولا تعدّلها."] },
  { key: "poster", t: "لوحة البلاغ العامة", icon: "megaphone", poster: true },
  { key: "free", t: "لوحة حرة", icon: "info", sub: "", items: ["", "", ""] },
];
const ICON_KEYS = ["monitor", "shield", "star", "exit", "send", "info", "megaphone", "clock", "book", "health", "quiet", "noentry", "food", "water", "assembly", "chat"];
const DEFAULT_TIPS = ["حافظ على جهازك ولا تغيّر إعداداته", "احفظ عملك في المجلد المحدد", "سجّل الخروج من حساباتك", "أطفئ الجهاز بعد الاستخدام"];

const pill = (on) => `rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`;
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) ?? "null"); localStorage.setItem(k, JSON.stringify(v)); } catch { /* تجاهل */ } return null; };

export default function LabStudio({ lab }) {
  const [part, setPart] = useState("boards");
  const [labName, setLabName] = useState("معمل الحاسب الآلي");
  const [devices, setDevices] = useState([]);
  const [rules, setRules] = useState([]);
  useEffect(() => {
    supabase.from("labs").select("name").eq("id", lab).maybeSingle().then(({ data }) => data?.name && setLabName(data.name));
    supabase.from("lab_devices").select("seat_no, code, cpu, ram, storage, os").eq("lab_id", lab).order("seat_no").then(({ data }) => setDevices(data ?? []));
    supabase.from("lab_rules").select("items").eq("id", 1).maybeSingle().then(({ data }) => setRules(data?.items ?? []));
  }, [lab]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="text-base font-bold text-ink">استوديو المعمل</h2>
        <p className="mt-0.5 text-sm text-muted">لوحات إرشادية وبطاقات أجهزة وخلفيات سطح مكتب بهوية البوابة، من قوالب جاهزة تعدّل نصوصها، ثم تطبعها أو تنزّلها.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[["boards", "اللوحات الإرشادية"], ["cards", "بطاقات الأجهزة"], ["walls", "خلفيات سطح المكتب"]].map(([k, t]) => (
            <button key={k} type="button" className={pill(part === k)} onClick={() => setPart(k)}>{t}</button>))}
        </div>
      </div>
      {part === "boards" && <Boards lab={lab} labName={labName} rules={rules} />}
      {part === "cards" && <Cards lab={lab} labName={labName} devices={devices} />}
      {part === "walls" && <Walls lab={lab} labName={labName} devices={devices} />}
    </div>
  );
}

/* ----------------------------- اللوحات الإرشادية ----------------------------- */
function Boards({ lab, labName, rules }) {
  const [open, setOpen] = useState(null);   // القالب المفتوح للتعديل
  const qr = useQrCodes(open?.poster ? [reportUrl(0, lab)] : [], 520);
  const start = (b) => {
    const saved = store(`mk_labboard_${b.key}`);
    setOpen(saved ? { ...b, ...saved } : { ...b, items: b.fromRules ? [...rules] : [...(b.items ?? [])], layout: b.layout ?? "cards" });
  };
  const set = (k, v) => setOpen((o) => { const n = { ...o, [k]: v }; store(`mk_labboard_${o.key}`, { t: n.t, sub: n.sub, items: n.items, icon: n.icon, layout: n.layout, note: n.note }); return n; });
  const reset = () => { store(`mk_labboard_${open.key}`, null); const b = BOARDS.find((x) => x.key === open.key); setOpen({ ...b, items: b.fromRules ? [...rules] : [...(b.items ?? [])], layout: b.layout ?? "cards" }); };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BOARDS.map((b) => (
          <button key={b.key} type="button" onClick={() => start(b)} className="card flex items-center gap-3 p-4 text-right transition-shadow hover:shadow-md">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm2 bg-mint-tint text-mint-deep [&>svg]:h-5 [&>svg]:w-5">{ICONS[b.icon]}</span>
            <span className="min-w-0"><b className="block text-sm text-ink">{b.t}</b>
              <span className="text-[11.5px] text-muted">{b.poster ? "رمز QR للبلاغ وخطواته" : b.fromRules ? "من قواعد السلامة المعتمدة" : b.key === "free" ? "عنوان وبنود تكتبها" : `${b.items.length} بنود`}</span></span>
          </button>))}
      </div>
      {open?.poster && (
        <LabPrintDialog title="لوحة البلاغ العامة" fileName={`لوحة-البلاغ-${labName}`} onClose={() => setOpen(null)}
          render={(th) => <PosterSheet theme={th} labName={labName} qr={qr[reportUrl(0, lab)]} />} />)}
      {open && !open.poster && (
        <LabPrintDialog title={open.t} fileName={`${open.t}-${labName}`} paper={open.paper ?? "A4"} onClose={() => setOpen(null)}
          render={(th) => <BoardSheet theme={th} labName={labName} title={open.t} sub={open.sub} items={open.items} icon={open.icon} layout={open.layout} note={open.note} />}>
          <div className="space-y-2">
            <input className="field text-sm" value={open.t} maxLength={60} onChange={(e) => set("t", e.target.value)} placeholder="العنوان" />
            <input className="field text-sm" value={open.sub ?? ""} maxLength={80} onChange={(e) => set("sub", e.target.value)} placeholder="سطر تحت العنوان (اختياري)" />
            <div className="space-y-1.5">
              {open.items.map((x, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="num w-5 text-center text-xs text-faint">{i + 1}</span>
                  <input className="field py-1.5 text-[13px]" value={x} maxLength={140} onChange={(e) => set("items", open.items.map((y, j) => (j === i ? e.target.value : y)))} />
                  <button type="button" className="text-xs text-danger" onClick={() => set("items", open.items.filter((_, j) => j !== i))}>✕</button>
                </div>))}
              {open.items.length < 16 && <button type="button" className="text-xs font-semibold text-mint-deep" onClick={() => set("items", [...open.items, ""])}>+ بند</button>}
            </div>
            <input className="field text-sm" value={open.note ?? ""} maxLength={120} onChange={(e) => set("note", e.target.value)} placeholder="سطر ختامي (اختياري)" />
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={pill(open.layout !== "steps")} onClick={() => set("layout", "cards")}>بطاقات</button>
              <button type="button" className={pill(open.layout === "steps")} onClick={() => set("layout", "steps")}>خطوات</button>
              <button type="button" className={pill((open.paper ?? "A4") === "A4")} onClick={() => setOpen((o) => ({ ...o, paper: "A4" }))}>A4</button>
              <button type="button" className={pill(open.paper === "A3")} onClick={() => setOpen((o) => ({ ...o, paper: "A3" }))}>A3</button>
            </div>
            <div className="flex flex-wrap gap-1">{ICON_KEYS.map((k) => (
              <button key={k} type="button" title={k} onClick={() => set("icon", k)}
                className={`grid h-8 w-8 place-items-center rounded-sm2 [&>svg]:h-4 [&>svg]:w-4 ${open.icon === k ? "bg-mint-deep text-white" : "border border-line text-muted"}`}>{ICONS[k]}</button>))}</div>
            <button type="button" className="text-xs text-muted underline" onClick={reset}>استعادة نص القالب</button>
          </div>
        </LabPrintDialog>)}
    </>
  );
}

/* ----------------------------- بطاقات الأجهزة ----------------------------- */
function Cards({ lab, labName, devices }) {
  const [kind, setKind] = useState(null);   // "big" | "stickers"
  const [note, setNote] = useState(() => store("mk_labcard_note") ?? "للمعلم: امسح الرمز للإبلاغ عن عطل");
  const [specs, setSpecs] = useState(false);
  const [page, setPage] = useState(0);
  const codes = useQrCodes(kind ? devices.map((d) => reportUrl(d.seat_no, lab)) : [], 360);
  const pages = Math.ceil(devices.length / 4);
  const saveNote = (v) => { setNote(v); store("mk_labcard_note", v); };
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => setKind("big")} className="card p-4 text-right hover:shadow-md">
          <b className="block text-sm text-ink">بطاقة الجهاز</b>
          <span className="text-[12px] text-muted">بطاقة كبيرة بالرقم والرمز ورمز البلاغ ومواصفاته، أربع في الورقة (<span className="num">{pages}</span> ورقة لـ<span className="num">{devices.length}</span> جهازًا)</span>
        </button>
        <button type="button" onClick={() => setKind("stickers")} className="card p-4 text-right hover:shadow-md">
          <b className="block text-sm text-ink">ملصقات الأجهزة</b>
          <span className="text-[12px] text-muted">ملصقات صغيرة 6.3 × 3.3 سم للشاشة أو صندوق الجهاز، حتى 24 في الورقة</span>
        </button>
      </div>
      {kind === "big" && (
        <LabPrintDialog title="بطاقات الأجهزة" fileName={`بطاقات-الأجهزة-${labName}-${page + 1}`} onClose={() => setKind(null)}
          render={(th) => <DeviceCardsSheet theme={th} lab={lab} devices={devices.slice(page * 4, page * 4 + 4)} labName={labName} codes={codes} note={note} specs={specs} />}>
          <div className="space-y-2">
            <p className="label">الورقة</p>
            <div className="flex flex-wrap gap-1">{Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" className={pill(page === i)} onClick={() => setPage(i)}>
                <span className="num">{devices[i * 4]?.seat_no}–{devices[Math.min(i * 4 + 3, devices.length - 1)]?.seat_no}</span></button>))}</div>
            <input className="field text-sm" value={note} maxLength={70} onChange={(e) => saveNote(e.target.value)} placeholder="سطر تعليمات (اختياري)" />
            <label className="flex items-center gap-2 text-xs text-ink"><input type="checkbox" className="accent-mint-deep" checked={specs} onChange={(e) => setSpecs(e.target.checked)} />إظهار مواصفات الجهاز</label>
          </div>
        </LabPrintDialog>)}
      {kind === "stickers" && (
        <LabPrintDialog title="ملصقات أجهزة المعمل" fileName={`ملصقات-${labName}`} onClose={() => setKind(null)}
          render={(th) => <StickersSheet theme={th} lab={lab} devices={devices} labName={labName} codes={codes} />} />)}
    </>
  );
}

/* ----------------------------- خلفيات سطح المكتب ----------------------------- */
function Walls({ lab, labName, devices }) {
  const [size, setSize] = useState(0);
  const [theme, setTheme] = useState("dark");
  const [seat, setSeat] = useState(null);
  const [withTips, setWithTips] = useState(() => store("mk_labwall_tips_on") ?? true);
  const [tipsTitle, setTipsTitle] = useState(() => store("mk_labwall_title") ?? "تعليمات المعمل");
  const [tips, setTips] = useState(() => store("mk_labwall_tips") ?? DEFAULT_TIPS);
  const [exporting, setExporting] = useState(null);
  const offRef = useRef(null);
  const [, setMsg] = useNotice(null);
  const codes = useQrCodes(devices.map((d) => reportUrl(d.seat_no, lab)), 520);
  const { w, h } = WALLPAPER_SIZES[size];
  const device = devices.find((d) => d.seat_no === Number(seat)) ?? devices[0];
  const props = (d) => ({ theme, w, h, device: d, labName, qr: codes[reportUrl(d.seat_no, lab)], tips: withTips ? tips : [], title: tipsTitle });
  const upd = (k, set, v) => { set(v); store(k, v); };

  useEffect(() => {
    if (!exporting) return;
    let alive = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 300));
      const nodes = offRef.current?.querySelectorAll(".lab-wall-wrap") ?? [];
      for (let i = 0; i < nodes.length && alive; i++) {
        await downloadNode(nodes[i], `خلفية-${exporting[i].code}-${w}x${h}.png`, 1);
        await new Promise((r) => setTimeout(r, 300));
      }
      if (alive) { if (exporting.length > 1) setMsg({ ok: true, text: `نُزّلت ${exporting.length} خلفية` }); setExporting(null); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exporting]);

  if (!device) return <p className="card px-4 py-6 text-center text-sm text-muted">لا أجهزة مسجلة في هذا المعمل.</p>;
  return (
    <div className="card grid gap-4 p-4 lg:grid-cols-[1fr_18rem]">
      <div>
        <div className="pointer-events-none"><Scaled w={w} h={h}><TipsWallSheet {...props(device)} /></Scaled></div>
        <p className="mt-1.5 text-center text-[11px] text-muted">معاينة {device.code} · أيقونات سطح المكتب تبقى في الجهة اليسرى</p>
      </div>
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <button type="button" className={pill(theme === "dark")} onClick={() => setTheme("dark")}>غامقة</button>
          <button type="button" className={pill(theme === "light")} onClick={() => setTheme("light")}>فاتحة</button>
        </div>
        <select className="field" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {WALLPAPER_SIZES.map((z, i) => <option key={z.label} value={i}>{z.label}</option>)}</select>
        <select className="field" value={device.seat_no} onChange={(e) => setSeat(e.target.value)}>
          {devices.map((d) => <option key={d.seat_no} value={d.seat_no}>معاينة {d.seat_no} · {d.code}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" className="accent-mint-deep" checked={withTips} onChange={(e) => upd("mk_labwall_tips_on", setWithTips, e.target.checked)} />بنود تعليمات في وسط الشاشة</label>
        {withTips && (
          <div className="space-y-1.5">
            <input className="field py-1.5 text-sm" value={tipsTitle} maxLength={40} onChange={(e) => upd("mk_labwall_title", setTipsTitle, e.target.value)} />
            {tips.map((x, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input className="field py-1.5 text-[13px]" value={x} maxLength={60} onChange={(e) => upd("mk_labwall_tips", setTips, tips.map((y, j) => (j === i ? e.target.value : y)))} />
                <button type="button" className="text-xs text-danger" onClick={() => upd("mk_labwall_tips", setTips, tips.filter((_, j) => j !== i))}>✕</button></div>))}
            {tips.length < 6 && <button type="button" className="text-xs font-semibold text-mint-deep" onClick={() => upd("mk_labwall_tips", setTips, [...tips, ""])}>+ بند</button>}
          </div>)}
        <button type="button" className="btn-ghost w-full" disabled={!!exporting} onClick={() => setExporting([device])}>{exporting?.length === 1 ? "جارٍ التجهيز…" : `تنزيل خلفية ${device.code}`}</button>
        <button type="button" className="btn-primary w-full" disabled={!!exporting} onClick={() => setExporting(devices)}>{exporting?.length > 1 ? "جارٍ التنزيل…" : `تنزيل خلفيات كل الأجهزة (${devices.length})`}</button>
      </div>
      {exporting && (
        <div ref={offRef} aria-hidden="true" style={{ position: "fixed", left: -30000, top: 0, pointerEvents: "none" }}>
          {exporting.map((d) => <TipsWallSheet key={d.seat_no} {...props(d)} />)}
        </div>)}
    </div>
  );
}
