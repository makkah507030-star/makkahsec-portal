// src/pages/studio/Studio.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import PrintPortal from "../../components/PrintPortal.jsx";
import Loader from "../../components/Loader.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { RegisterCover, Divider, Spines, Circular, DoorSign, Social, ClassDoor, Timetable, Seats, Sign, Badges, Rollup, Thanks, Notice, SPINE_SIZES, ICONS, ICON_LABEL } from "./Sheets.jsx";
import { SECTIONS, TEMPLATES, templateOf, sheetDims, SOCIAL_FORMATS } from "./templates";
import {
  THEMES, toWestern, useFontsReady, academicYearLabel, TERM_LABEL, ROLE_DEPT, classRange,
  STUDIO_ACCESS_KEY, parseAccess, defaultAccess, GRADE_OPTIONS, classCode,
} from "./lib";
import { canUseTemplate } from "../../lib/formRoles";
import Identity from "./Identity.jsx";
import Access from "./Access.jsx";
import Scaled from "./Scaled.jsx";
import { StudioAssets } from "./assets";
import { loadSchoolStamp } from "./data";

/* =====================================================================
   استوديو البوابة — قوالب بهوية المدرسة يملؤها المستخدم ويطبعها أو يصدّرها.
   قسم للمعلمين وقسم للإداريين، ومن يجمع الدورين يرى القسمين.
   ===================================================================== */

const pill = (on) =>
  `rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
    on ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`;

const isMissingTable = (e) => /does not exist|schema cache|PGRST205|42P01/i.test(e?.message ?? "") ||
  e?.code === "42P01" || e?.code === "PGRST205";

/* ----------------------- بيانات التعبئة التلقائية ----------------------- */
function useStudioCtx() {
  const { session, profile, adminRoles, isTeacher } = useSession();
  const [ctx, setCtx] = useState(null);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    (async () => {
      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term", STUDIO_ACCESS_KEY]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const term = Number(m.active_term ?? 1);

      // المعلم: مادته الأكثر حصصًا وفصوله مجمّعة بالصف
      let subject = "", classes = "", teacherId = null;
      if (isTeacher) {
        const { data: t } = await supabase.from("teachers").select("id").eq("user_id", uid).maybeSingle();
        teacherId = t?.id ?? null;
        if (t) {
          const { data: sch } = await supabase.from("schedule")
            .select("classes(class_no, grade), subjects(name)")
            .eq("teacher_id", t.id).eq("academic_year", m.active_year ?? "").eq("term", term);
          const count = {};
          const byGrade = {};
          (sch ?? []).forEach((r) => {
            const s = r.subjects?.name; if (s) count[s] = (count[s] ?? 0) + 1;
            const g = r.classes?.grade; if (g) (byGrade[g] ??= []).push(r.classes.class_no);
          });
          subject = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
          classes = Object.keys(byGrade).sort()
            .map((g) => `${GRADE_NAMES[g] ?? g} (${classRange(byGrade[g])})`).join("، ");
        }
      }

      // فصول العام الحالي — للوحات الفصول وطباعتها دفعة واحدة
      const { data: cls } = await supabase.from("classes").select("class_no, grade, track")
        .eq("academic_year", m.active_year ?? "").eq("is_active", true);
      const classList = (cls ?? []).slice().sort((a, b) => a.grade - b.grade || a.class_no - b.class_no);

      // الإداري: قسمه ورمز سجلاته وصفته من دوره الأول المعروف
      const role = (adminRoles ?? []).find((r) => ROLE_DEPT[r] && r !== "tech_support")
        ?? (adminRoles ?? []).find((r) => ROLE_DEPT[r]);
      const [dept, deptCode] = ROLE_DEPT[role] ?? ["", ""];

      setCtx({
        name: profile?.full_name ?? "",
        year: academicYearLabel(),
        term: TERM_LABEL[term] ?? "",
        subject, classes, dept, deptCode,
        roleTitle: ADMIN_ROLE_LABEL[role] ?? "",
        access: parseAccess(m[STUDIO_ACCESS_KEY]),
        activeYear: m.active_year ?? "", activeTerm: term, teacherId,
        classList,
      });
    })();
  }, [session, profile, adminRoles, isTeacher]);

  return ctx;
}

/* ----------------------------- الورقة ----------------------------- */
export function SheetFor({ tpl, theme, orient, data }) {
  if (tpl.sheet === "cover") return <RegisterCover theme={theme} orient={orient} kind={tpl.kind} d={data} />;
  if (tpl.sheet === "divider") return <Divider theme={theme} d={data} />;
  if (tpl.sheet === "circular") return <Circular theme={theme} d={data} />;
  if (tpl.sheet === "door") return <DoorSign theme={theme} d={data} />;
  if (tpl.sheet === "social") return <Social theme={theme} d={data} />;
  if (tpl.sheet === "classdoor") return <ClassDoor theme={theme} d={data} />;
  if (tpl.sheet === "timetable") return <Timetable theme={theme} d={data} />;
  if (tpl.sheet === "seats") return <Seats theme={theme} d={data} />;
  if (tpl.sheet === "sign") return <Sign theme={theme} orient={orient} d={data} />;
  if (tpl.sheet === "badge") return <Badges theme={theme} d={data} />;
  if (tpl.sheet === "rollup") return <Rollup theme={theme} d={data} />;
  if (tpl.sheet === "thanks") return <Thanks theme={theme} d={data} />;
  if (tpl.sheet === "notice") return <Notice theme={theme} d={data} />;
  return <Spines theme={theme} d={data} />;
}

// بيانات المعرض: التعبئة التلقائية مع عيّنة توضيحية
const galleryData = (tpl, ctx, section) =>
  ({ ...tpl.defaults(ctx, section), ...(typeof tpl.sample === "function" ? tpl.sample(ctx, section) : tpl.sample ?? {}) });

/* ----------------------------- الصفحة ----------------------------- */
export default function Studio() {
  const { session, profile, adminRoles, isTeacher, isSuper } = useSession();
  const ctx = useStudioCtx();
  const [access, setAccess] = useState(null);     // بعد الحفظ من «إدارة القوالب» دون إعادة تحميل
  const [stamp, setStamp] = useState(null);       // ختم المدرسة المعتمد من البوابة
  useEffect(() => { loadSchoolStamp().then(setStamp); }, []);
  const assets = useMemo(() => ({ stamp }), [stamp]);
  const withAssets = (el) => <StudioAssets.Provider value={assets}>{el}</StudioAssets.Provider>;
  useFontsReady();

  // المعلم يرى قسم المعلمين، والإداري قسم الإداريين، والمدير والدعم الفني القسمين
  const isAdmin = profile?.role === "admin";
  // «للطالب» للمعلمين والإداريين معًا
  const sectionOk = (key) => isSuper || (key === "teacher" ? isTeacher : key === "admin" ? isAdmin : isTeacher || isAdmin);
  const sections = SECTIONS.filter((s) => sectionOk(s.key));
  const [section, setSection] = useState(null);
  const current = section ?? sections[0]?.key ?? "teacher";
  const [tab, setTab] = useState("gallery");      // gallery | mine | identity | access
  const [edit, setEdit] = useState(null);         // { tpl, theme, orient, data, id, section }

  const rules = access ?? ctx?.access ?? {};
  const allowed = (tpl) => isSuper || canUseTemplate(
    { allowed_roles: rules[tpl.key] ?? defaultAccess(tpl) }, { adminRoles, isAdmin, isTeacher });

  const open = (tpl, saved) => setEdit(saved
    ? { tpl, theme: saved.theme, orient: saved.orient, data: saved.data, id: saved.id, section: saved.section }
    : { tpl, theme: tpl.defaultTheme ?? "light", orient: tpl.defaultOrient ?? "portrait", data: tpl.defaults(ctx ?? {}, current), id: null, section: current });

  if (!ctx) return <Loader />;

  if (edit) {
    return withAssets(<Editor key={edit.id ?? edit.tpl.key} init={edit} ctx={ctx} uid={session?.user?.id} onBack={() => setEdit(null)} />);
  }

  /* قوالب القسم المسموحة للمستخدم. والقالب الممنوح لدور خارج أقسامه
     (مثل غلاف المعلم لرائد النشاط) يظهر في أول قسم يراه. */
  const list = TEMPLATES.filter((t) => allowed(t) &&
    (t.sections.includes(current) || (!t.sections.some(sectionOk) && current === sections[0]?.key)));

  return withAssets(
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">استوديو البوابة</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          قوالب بهوية المدرسة: اختر القالب، واملأ بياناته، واطبعه أو صدّره. التصميم ثابت،
          فيخرج كل ما يصدر من المدرسة بمظهر واحد — من غلاف السجل إلى التعميم ومنشور التواصل.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sections.length > 1 && sections.map((s) => (
          <button key={s.key} className={pill(tab === "gallery" && current === s.key)}
                  onClick={() => { setSection(s.key); setTab("gallery"); }}>
            {s.label}
          </button>
        ))}
        {sections.length === 1 && (
          <button className={pill(tab === "gallery")} onClick={() => setTab("gallery")}>القوالب</button>
        )}
        <button className={pill(tab === "mine")} onClick={() => setTab("mine")}>تصاميمي</button>
        <button className={pill(tab === "identity")} onClick={() => setTab("identity")}>الهوية البصرية</button>
        {isSuper && (
          <button className={pill(tab === "access")} onClick={() => setTab("access")}>إدارة القوالب</button>
        )}
      </div>

      {tab === "identity" && <Identity />}
      {tab === "access" && isSuper && <Access rules={rules} onSaved={setAccess} />}
      {tab === "gallery" && !list.length && (
        <p className="card px-4 py-6 text-sm text-muted">لا توجد قوالب متاحة لك في هذا القسم بعد.</p>
      )}
      {tab === "gallery" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {list.map((tpl) => {
            // ملف Office: بطاقة تنزيل مباشرة بمعاينة الملف
            if (tpl.download) {
              const x = tpl.download;
              return (
                <a key={tpl.key} href={x.href} download={x.file}
                  className="card group flex flex-col overflow-hidden p-3 text-right transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40">
                  <div className="relative overflow-hidden rounded-card shadow-card ring-1 ring-line/60" style={{ aspectRatio: x.ratio }}>
                    <img src={x.preview} alt="" className="h-full w-full object-cover" loading="lazy" />
                    <span className="absolute left-2 top-2 rounded-sm2 px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: x.color }}>{x.app}</span>
                  </div>
                  <p className="mt-3 font-semibold text-ink">{tpl.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{tpl.desc}</p>
                  <span className="mt-2 self-start rounded-pill bg-mint-deep px-3 py-1 text-xs font-medium text-white">تنزيل الملف</span>
                </a>
              );
            }
            const d = galleryData(tpl, ctx, current);
            const sz = sheetDims(tpl, "portrait", d);
            return (
              <button key={tpl.key} onClick={() => open(tpl)}
                className="card group overflow-hidden p-3 text-right transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40">
                <div className="pointer-events-none">
                  <Scaled w={sz.w} h={sz.h}>
                    <SheetFor tpl={tpl} theme={tpl.defaultTheme ?? "light"} orient="portrait" data={d} />
                  </Scaled>
                </div>
                <p className="mt-3 font-semibold text-ink">{tpl.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{tpl.desc}</p>
              </button>
            );
          })}
        </div>
      ) : tab === "mine" && (
        <MyDesigns uid={session?.user?.id} onOpen={(row) => { const tpl = templateOf(row.template); if (tpl) open(tpl, row); }} />
      )}
    </div>
  );
}

/* ----------------------------- المحرّر ----------------------------- */
function Editor({ init, ctx: baseCtx, uid, onBack }) {
  const { tpl } = init;
  const [theme, setTheme] = useState(init.theme);
  const [orient, setOrient] = useState(init.orient);
  const [data, setData] = useState(init.data);
  const [id, setId] = useState(init.id);
  const [busy, setBusy] = useState(false);
  // بيانات إضافية يحتاجها القالب (جدول الحصص، الطلاب، المنسوبون) تُحمَّل عند فتحه
  const [extra, setExtra] = useState(tpl.load ? null : {});
  useEffect(() => {
    if (!tpl.load) return;
    let alive = true;
    tpl.load(baseCtx ?? {}).then((x) => { if (alive) setExtra(x ?? {}); })
      .catch(() => { if (alive) setExtra({}); });
    return () => { alive = false; };
  }, [tpl, baseCtx]);
  const ctx = useMemo(() => ({ ...(baseCtx ?? {}), ...(extra ?? {}) }), [baseCtx, extra]);
  const [msg, setMsg] = useNotice(null);
  const sheetRef = useRef(null);
  const size = sheetDims(tpl, orient, data);
  const printable = tpl.print !== false;
  // قالب الدفعة (لوحات الفصول) يطبع صفحة لكل فصل
  const pages = tpl.pages ? tpl.pages(data, ctx) : [data];
  // المعاينة: ما يُعرض فعلًا للاختيار الحالي (مثل جدول الفصل المختار)
  const view = tpl.view ? tpl.view(data, ctx) : data;

  const set = (name, v) => setData((d) => {
    const next = { ...d, [name]: v };
    return tpl.derive ? tpl.derive(next, name, ctx ?? {}) : next;
  });

  // على iPhone/iPad تُطبع صورة الورقة لا الورقة نفسها: محرّك الطباعة هناك يتجاهل شفافية
  // الألوان والتدرّجات (تسودّ الخلفية وتظهر الهالة دائرة صلبة)، والصورة تطابق المعاينة تمامًا
  const [printImgs, setPrintImgs] = useState(null);
  useEffect(() => {
    const clear = () => setPrintImgs(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  const printNow = async () => {
    // عنوان الصفحة يصبح اسم ملف PDF المقترح عند الحفظ
    const prev = document.title;
    document.title = `${tpl.title} - ${data.title || data.items?.[0]?.title || ""}`.trim();
    if (isIOS()) {
      setBusy(true);
      // تُعاد الأوراق الحيّة أولًا (لا صور طباعة سابقة) ثم تُلتقط
      setPrintImgs(null);
      await new Promise((r) => setTimeout(r, 50));
      try { setPrintImgs(await rasterSheets(size)); }
      catch (e) { setMsg({ ok: false, text: `تعذّر تجهيز الطباعة: ${e.message ?? e}` }); setBusy(false); return; }
      setBusy(false);
      // انتظار رسم الصور في منطقة الطباعة قبل فتح نافذتها
      await new Promise((r) => setTimeout(r, 300));
    }
    window.print();
    setTimeout(() => { document.title = prev; }, 500);
  };

  const exportPng = async () => {
    const node = sheetRef.current?.firstElementChild;
    if (!node) return;
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      await document.fonts?.ready;
      // المنشور بمقاسه الرقمي الفعلي (1080)، والأوراق بدقة مضاعفة للوضوح
      const blob = await toBlob(node, { pixelRatio: tpl.exportRatio ?? (tpl.sheet === "social" ? 1 : 2), cacheBust: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tpl.title} - ${data.title || data.items?.[0]?.title || "استوديو البوابة"}.png`;
      // يُضاف للصفحة قبل الضغط ليحترم المتصفح اسم الملف
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setMsg({ ok: false, text: `تعذّر تصدير الصورة: ${e.message ?? e}` });
    }
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    const row = {
      template: tpl.key, section: init.section, theme, orient, data,
      title: data.title || data.items?.[0]?.title || tpl.title, updated_at: new Date().toISOString(),
    };
    const q = id
      ? supabase.from("studio_designs").update(row).eq("id", id).select("id").single()
      : supabase.from("studio_designs").insert({ ...row, user_id: uid }).select("id").single();
    const { data: r, error } = await q;
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: isMissingTable(error)
        ? "حفظ التصاميم يحتاج تفعيلًا من الدعم الفني (supabase/studio.sql)."
        : `تعذّر الحفظ: ${error.message}` });
      return;
    }
    setId(r.id);
    setMsg({ ok: true, text: "حُفظ في «تصاميمي»، ويمكنك الرجوع إليه وتعديله في أي وقت." });
  };

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-ink">{tpl.title}</h1>
          <p className="text-sm text-muted">{tpl.desc}</p>
        </div>
        <button onClick={onBack} className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
          رجوع للاستوديو
        </button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* المعاينة */}
        <div className="order-2 lg:sticky lg:top-4 lg:order-1">
          <Scaled w={size.w} h={size.h} innerRef={sheetRef}>
            {extra
              ? <SheetFor tpl={tpl} theme={theme} orient={orient} data={view} />
              : <div className="flex items-center justify-center" style={{ height: size.h }}><Loader /></div>}
          </Scaled>
        </div>

        {/* الإعدادات */}
        <section className="card order-1 space-y-4 p-4 lg:order-2">
          <div>
            <p className="mb-1.5 text-xs text-muted">النسخة</p>
            <div className="flex flex-wrap gap-1.5">
              {THEMES.map((t) => (
                <button key={t.key} className={pill(theme === t.key)} onClick={() => setTheme(t.key)}>{t.label}</button>
              ))}
            </div>
            <ul className="mt-2 space-y-1 rounded-sm2 bg-canvas px-3 py-2">
              {THEMES.map((t) => (
                <li key={t.key} className={`text-[11.5px] leading-relaxed ${
                  theme === t.key ? "font-semibold text-mint-deep" : "text-muted"}`}>
                  <span className="font-semibold">{t.label}:</span> {t.hint}
                </li>
              ))}
            </ul>
          </div>

          {tpl.orients && (
            <div>
              <p className="mb-1.5 text-xs text-muted">الاتجاه</p>
              <div className="flex gap-1.5">
                <button className={pill(orient === "portrait")} onClick={() => setOrient("portrait")}>طولي</button>
                <button className={pill(orient === "landscape")} onClick={() => setOrient("landscape")}>عرضي</button>
              </div>
            </div>
          )}

          {tpl.fields.map((f) => (
            <Field key={f.name} f={f} tpl={tpl} data={data} set={set} ctx={ctx} />
          ))}

          {msg && (
            <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}

          <div className="grid gap-2 border-t border-line pt-4">
            {printable
              ? <button className="btn-primary w-full" onClick={printNow}>طباعة / حفظ PDF</button>
              : <button disabled={busy} className="btn-primary w-full disabled:opacity-50" onClick={exportPng}>تنزيل الصورة</button>}
            <div className={`grid gap-2 ${printable ? "grid-cols-2" : ""}`}>
              {printable && (
                <button disabled={busy} onClick={exportPng}
                  className="rounded-sm2 border border-line py-2 text-sm font-medium text-mint-deep hover:bg-canvas disabled:opacity-50">
                  تنزيل صورة PNG
                </button>
              )}
              <button disabled={busy} onClick={save}
                className="rounded-sm2 border border-line py-2 text-sm font-medium text-mint-deep hover:bg-canvas disabled:opacity-50">
                {id ? "حفظ التعديل" : "حفظ في تصاميمي"}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-faint">
              {printable
                ? tpl.printSize
                  ? <>«طباعة / حفظ PDF» يُخرج ملف PDF بالمقاس الحقيقي {size.w / 10} × {size.h / 10} سم — اختر «حفظ بتنسيق PDF» وأرسله للمطبعة. والصورة PNG بدقة 100 نقطة/بوصة. أبقِ المحتوى المهم أعلى من آخر 20 سم (تدخل في قاعدة الستاند).</>
                  : <>{pages.length > 1 && <b className="text-mint-deep">ستُطبع {pagesLabel(pages.length)}. </b>}
                    في نافذة الطباعة: الورق A4{size.w > size.h ? " بالعرض" : " بالطول"}، والهوامش «بلا»، وفعّل «طباعة الخلفيات».</>
                : <>الصورة بمقاس {size.w}×{size.h} جاهزة للنشر. الغامقة أنسب لوسائل التواصل.</>}
            </p>
          </div>
        </section>
      </div>

      {printable && (
        <PrintPortal id="studio-print" landscape={size.w > size.h}
          extraCss={`#studio-print .sheet { break-after: page; } #studio-print .sheet:last-child { break-after: auto; }${
            tpl.printSize
              // مقاس الطباعة الفعلي (مثل رول أب 85 × 200 سم): الورقة مرسومة 1 بكسل = 1 مم فتُكبَّر إلى المليمتر
              ? ` @page { size: ${size.w}mm ${size.h}mm; margin: 0; } #studio-print .sheet { zoom: 3.7795; }` : ""}`}>
          {printImgs
            ? printImgs.map((src, i) => <img key={i} className="sheet" src={src} alt=""
                style={{ display: "block", width: size.w, height: size.h }} />)
            : pages.map((p, i) => <SheetFor key={i} tpl={tpl} theme={theme} orient={orient} data={p} />)}
        </PrintPortal>
      )}
    </div>
  );
}

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/* صور أوراق منطقة الطباعة: تُظهر المنطقة خارج الشاشة لحظة الالتقاط ثم تعود مخفية */
async function rasterSheets(size) {
  const portal = document.querySelector("#studio-print")?.parentElement;
  if (!portal) return [];
  const { toPng } = await import("html-to-image");
  await document.fonts?.ready;
  // دقة تقارب 300 نقطة/بوصة للـ A4، ضمن حد مساحة الرسم في Safari (~16 مليون بكسل)
  const ratio = Math.min(3, Math.sqrt(15e6 / (size.w * size.h)));
  portal.style.cssText = "display:block;position:fixed;left:-20000px;top:0;";
  try {
    const out = [];
    for (const node of portal.querySelectorAll("#studio-print .sheet")) {
      const opts = { pixelRatio: ratio, cacheBust: true, width: size.w, height: size.h };
      await toPng(node, opts); // Safari يرسم الصور المضمّنة في المرة الثانية فقط
      out.push(await toPng(node, opts));
    }
    return out;
  } finally { portal.style.cssText = ""; }
}

// العدد مع المعدود: صفحتان، 3 صفحات، 11 صفحة
const pagesLabel = (n) => (n === 2 ? "صفحتان" : n >= 3 && n <= 10 ? `${n} صفحات` : `${n} صفحة`);

/* ----------------------------- الحقول ----------------------------- */
function Field({ f, tpl, data, set, ctx }) {
  const presets = tpl.presets?.[f.name];
  const text = (v) => toWestern(v).slice(0, f.max ?? 80);

  if (f.type === "number") {
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {Array.from({ length: f.max - f.min + 1 }, (_, i) => i + f.min).map((n) => (
            <button key={n} onClick={() => set(f.name, n)}
              className={`num h-8 rounded-sm2 text-sm font-semibold ${f.display ? "min-w-[2.75rem] px-2" : "w-8"} ${
                Number(data[f.name]) === n ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {f.display ? f.display(n, data) : n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (f.type === "choice") {
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {f.options.map((o) => (
            <button key={o} className={pill(data[f.name] === o)} onClick={() => set(f.name, o)}>{o}</button>
          ))}
        </div>
      </div>
    );
  }

  if (f.type === "students") return <StudentsField data={data} set={set} ctx={ctx} />;

  if (f.type === "logo") {
    // الشعار يُحفظ PNG بشفافيته، وأطول ضلع 1400 بكسل — يكفي لطباعة واضحة على الرول أب
    const pick = (file) => {
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1400 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        set(f.name, cv.toDataURL("image/png"));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    };
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 flex items-center gap-2">
          {data[f.name] && <img src={data[f.name]} alt="" className="h-12 w-12 rounded-sm2 bg-canvas object-contain p-1 ring-1 ring-line" />}
          <label className="cursor-pointer rounded-pill border border-line bg-white px-4 py-1.5 text-sm text-muted hover:bg-canvas">
            {data[f.name] ? "تغيير الشعار" : "رفع شعار المناسبة"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {data[f.name] && <button className="text-xs text-absent" onClick={() => set(f.name, "")}>إزالة</button>}
        </div>
      </div>
    );
  }

  if (f.type === "select") {
    const opts = f.options(data, ctx ?? {});
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <select className="field mt-1 w-full" value={data[f.name] || opts[0]?.[0] || ""}
                onChange={(e) => set(f.name, e.target.value)}>
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {!opts.length && <p className="mt-1 text-[11px] text-muted">لا توجد بيانات بعد في البوابة لهذا الخيار.</p>}
      </div>
    );
  }

  if (f.type === "opts") {
    const opts = f.options(data, ctx ?? {});
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {opts.map(([v, l]) => (
            <button key={v} className={pill((data[f.name] ?? "") === v)} onClick={() => set(f.name, v)}>{l}</button>
          ))}
        </div>
      </div>
    );
  }

  if (f.type === "photo") {
    // تُصغَّر الصورة إلى 360 بكسل مربعًا وتُحفظ مع التصميم — لا تُرفع لأي خادم
    const pick = (file) => {
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        const n = 360, cv = document.createElement("canvas");
        cv.width = cv.height = n;
        const k = Math.min(img.width, img.height);
        const g = cv.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, n, n);   // الخلفية الشفافة تصير بيضاء لا سوداء
        g.drawImage(img, (img.width - k) / 2, (img.height - k) / 2, k, k, 0, 0, n, n);
        set(f.name, cv.toDataURL("image/jpeg", 0.85));
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    };
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 flex items-center gap-2">
          {data[f.name] && <img src={data[f.name]} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-line" />}
          <label className="cursor-pointer rounded-pill border border-line bg-white px-4 py-1.5 text-sm text-muted hover:bg-canvas">
            {data[f.name] ? "تغيير الصورة" : "اختيار صورة"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {data[f.name] && (
            <button className="text-xs text-absent" onClick={() => set(f.name, "")}>إزالة</button>
          )}
        </div>
      </div>
    );
  }

  if (f.type === "batch") {
    const list = ctx?.classList ?? [];
    const g = GRADE_OPTIONS.indexOf(data.grade) + 1;
    const inGrade = list.filter((k) => k.grade === g).length;
    const opts = [
      ["one", "هذا الفصل فقط"],
      ...(inGrade ? [["grade", `كل فصول ${data.grade} (${inGrade})`]] : []),
      ...(list.length ? [["all", `كل الفصول (${list.length})`]] : []),
    ];
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {opts.map(([k, l]) => (
            <button key={k} className={pill((data[f.name] ?? "one") === k)} onClick={() => set(f.name, k)}>{l}</button>
          ))}
        </div>
        {data[f.name] && data[f.name] !== "one" && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            تُطبع لوحة لكل فصل من جدول الفصول برقمه ومساره. المعاينة للفصل المختار.
          </p>
        )}
      </div>
    );
  }

  if (f.type === "format") {
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {Object.entries(SOCIAL_FORMATS).map(([k, s]) => (
            <button key={k} className={pill((data[f.name] ?? "square") === k)} onClick={() => set(f.name, k)}>{s.label}</button>
          ))}
        </div>
      </div>
    );
  }

  if (f.type === "icon") {
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 grid grid-cols-4 gap-1.5">
          {f.options.map((k) => (
            <button key={k} onClick={() => set(f.name, k)} title={ICON_LABEL[k]}
              className={`flex flex-col items-center gap-1 rounded-sm2 py-2 text-[10.5px] [&_svg]:h-5 [&_svg]:w-5 ${
                data[f.name] === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {ICONS[k]}{ICON_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (f.type === "list") {
    const rows = Array.from({ length: f.rows }, (_, i) => data[f.name]?.[i] ?? "");
    const put = (i, v) => set(f.name, rows.map((r, j) => (j === i ? toWestern(v).slice(0, f.max ?? 80) : r)));
    return (
      <div>
        <label className="text-xs text-muted">{f.label} — الفارغ لا يظهر</label>
        <div className="mt-1 space-y-1.5">
          {rows.map((r, i) => (
            <input key={i} className="field w-full" placeholder={`النقطة ${i + 1}`} value={r}
                   onChange={(e) => put(i, e.target.value)} />
          ))}
        </div>
      </div>
    );
  }

  if (f.type === "textarea") {
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <textarea rows={f.rows ?? 2} className="field mt-1 w-full leading-relaxed" value={data[f.name] ?? ""}
                  onChange={(e) => set(f.name, text(e.target.value))} />
      </div>
    );
  }

  if (f.type === "toc") {
    const rows = Array.from({ length: f.rows }, (_, i) => data.toc?.[i] ?? { a: "", b: "" });
    const put = (i, k, v) => set("toc", rows.map((r, j) => (j === i ? { ...r, [k]: toWestern(v).slice(0, 40) } : r)));
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1 space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px] gap-1.5">
              <input className="field" placeholder={`البند ${i + 1}`} value={r.a} onChange={(e) => put(i, "a", e.target.value)} />
              <input className="field" placeholder="ملاحظة" value={r.b} onChange={(e) => put(i, "b", e.target.value)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (f.type === "size") {
    return (
      <div>
        <label className="text-xs text-muted">{f.label}</label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {Object.entries(SPINE_SIZES).map(([k, s]) => (
            <button key={k} className={pill(data.size === k)} onClick={() => set("size", k)}>{s.label}</button>
          ))}
        </div>
      </div>
    );
  }

  if (f.type === "spines") {
    const count = SPINE_SIZES[data.size]?.count ?? 4;
    const items = Array.from({ length: count }, (_, i) => data.items?.[i] ?? { title: "", sub: "", no: "" });
    const put = (i, k, v, max) =>
      set("items", items.map((r, j) => (j === i ? { ...r, [k]: toWestern(v).slice(0, max) } : r)));
    return (
      <div>
        <label className="text-xs text-muted">{f.label} — الفارغ لا يُطبع</label>
        <div className="mt-1 space-y-2">
          {items.map((r, i) => (
            <div key={i} className="space-y-1.5 rounded-sm2 bg-canvas p-2">
              <input className="field" placeholder={`عنوان الملصق ${i + 1}`} value={r.title}
                     onChange={(e) => put(i, "title", e.target.value, 30)} />
              <div className="grid grid-cols-[1fr_70px] gap-1.5">
                <input className="field" placeholder="سطر فرعي (المادة أو القسم)" value={r.sub}
                       onChange={(e) => put(i, "sub", e.target.value, 30)} />
                <input className="field num text-center" placeholder="رقم" value={r.no}
                       onChange={(e) => put(i, "no", e.target.value, 3)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs text-muted">{f.label}</label>
      <input className="field mt-1 w-full" dir={f.dir} value={data[f.name] ?? ""}
             onChange={(e) => set(f.name, text(e.target.value))} />
      {presets && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {presets.map((p) => (
            <button key={p} onClick={() => set(f.name, p)}
              className="rounded-pill border border-[#CCF2DB] bg-mint-tint px-2.5 py-0.5 text-[11px] font-medium text-mint-deep hover:bg-[#CCF2DB]">
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- اختيار الطلاب ----------------------------- */
function StudentsField({ data, set, ctx }) {
  const all = useMemo(() => (ctx?.students ?? []).map((s) => ({ id: s.student_id, name: s.full_name, grade: s.grade, cls: classCode(s.grade, s.class_no) })), [ctx]);
  const classes = useMemo(() => [...new Set(all.map((s) => s.cls))].sort((a, b) => Number(a) - Number(b)), [all]);
  const [fc, setFc] = useState("");
  const [manual, setManual] = useState({ name: "", cls: "" });
  const cur = fc || classes[0] || "";
  const people = data.people ?? [];
  // المطابقة بمعرّف الطالب (قد يتشابه اسمان في فصل واحد)، وبالاسم والفصل لما أُضيف يدويًا
  const same = (x, p) => (p.id ? x.id === p.id : !x.id && x.name === p.name && x.cls === p.cls);
  const has = (p) => people.some((x) => same(x, p));
  const toggle = (p) => set("people", has(p) ? people.filter((x) => !same(x, p)) : [...people, p]);
  const inClass = all.filter((s) => s.cls === cur);

  if (data.mode === "class") {
    return (
      <div>
        <label className="text-xs text-muted">الفصل</label>
        {classes.length ? (
          <select className="field mt-1 w-full" value={data.cls || ""} onChange={(e) => set("cls", e.target.value)}>
            <option value="">اختر الفصل</option>
            {classes.map((c) => <option key={c} value={c}>فصل {c}</option>)}
          </select>
        ) : (
          <input className="field mt-1 w-full" placeholder="رقم الفصل، مثل 101" value={data.cls || ""}
                 onChange={(e) => set("cls", toWestern(e.target.value).slice(0, 6))} />
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <label className="text-xs text-muted">الطلاب — اختر من الفصل أو أضف اسمًا يدويًا</label>
      {classes.length > 0 && (
        <div className="rounded-sm2 bg-canvas p-2">
          <div className="flex items-center gap-2">
            <select className="field flex-1" value={cur} onChange={(e) => setFc(e.target.value)}>
              {classes.map((c) => <option key={c} value={c}>فصل {c}</option>)}
            </select>
            <button className="rounded-pill border border-line bg-white px-3 py-1.5 text-xs text-mint-deep"
                    onClick={() => set("people", [...people, ...inClass.filter((p) => !has(p))])}>تحديد الكل</button>
          </div>
          <div className="mt-2 max-h-44 space-y-0.5 overflow-y-auto">
            {inClass.map((p) => (
              <label key={p.id ?? p.name} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-white">
                <input type="checkbox" checked={has(p)} onChange={() => toggle(p)} />{p.name}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-[1fr_76px_auto] gap-1.5">
        <input className="field" placeholder="اسم الطالب" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value.slice(0, 50) })} />
        <input className="field num text-center" placeholder="الفصل" value={manual.cls}
               onChange={(e) => setManual({ ...manual, cls: toWestern(e.target.value).slice(0, 4) })} />
        <button className="rounded-pill border border-line bg-white px-3 text-xs text-mint-deep disabled:opacity-40" disabled={!manual.name.trim()}
                onClick={() => { const c = manual.cls.trim(); set("people", [...people, { name: manual.name.trim(), cls: c, grade: Number(c[0]) || null }]); setManual({ name: "", cls: "" }); }}>
          إضافة
        </button>
      </div>
      {people.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {people.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-pill bg-mint-tint px-2.5 py-0.5 text-[11px] text-mint-deep">
              {p.name}{p.cls && <span className="num opacity-70">· {p.cls}</span>}
              <button className="text-absent" onClick={() => set("people", people.filter((_, j) => j !== i))}>×</button>
            </span>
          ))}
          <button className="text-[11px] text-absent" onClick={() => set("people", [])}>مسح الكل</button>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- تصاميمي ----------------------------- */
function MyDesigns({ uid, onOpen }) {
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("studio_designs")
      .select("*").eq("user_id", uid).order("updated_at", { ascending: false });
    if (error) { setMissing(isMissingTable(error)); setRows([]); return; }
    setRows(data ?? []);
  };
  useEffect(() => { if (uid) load(); }, [uid]);

  const remove = async (r) => {
    if (!window.confirm(`حذف «${r.title}» من تصاميمك؟`)) return;
    await supabase.from("studio_designs").delete().eq("id", r.id);
    load();
  };

  const byDate = useMemo(() => rows ?? [], [rows]);

  if (!rows) return <Loader compact />;
  if (missing) {
    return (
      <p className="card px-4 py-6 text-sm text-muted">
        حفظ التصاميم غير مفعّل بعد — يفعّله الدعم الفني بتشغيل <span dir="ltr">supabase/studio.sql</span>.
        يمكنك الآن الطباعة والتصدير مباشرة.
      </p>
    );
  }
  if (!byDate.length) {
    return <p className="card px-4 py-6 text-sm text-muted">لم تحفظ تصاميم بعد. اختر قالبًا واضغط «حفظ في تصاميمي».</p>;
  }

  return (
    <div className="card divide-y divide-line overflow-hidden">
      {byDate.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{r.title}</p>
            <p className="text-xs text-muted">
              {templateOf(r.template)?.title ?? r.template} · {THEMES.find((t) => t.key === r.theme)?.label}
              {r.orient === "landscape" ? " · عرضي" : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onOpen(r)} className="btn-primary px-4 py-1.5 text-xs">فتح</button>
            <button onClick={() => remove(r)}
              className="rounded-pill border border-absent/40 px-3 py-1.5 text-xs text-absent hover:bg-absent/5">
              حذف
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
