// src/components/MediaPressCard.jsx
import iconWhite from "../assets/icon-white.png";
import { fmtDate } from "../lib/dates";

/* =====================================================================
   البطاقة الإعلامية لعضو الفريق الإعلامي وقائده (supabase/media_4.sql): بطاقة صحفية كلاسيكية
   بألوان الهوية الرسمية (الأخضر والذهبي): ترويسة خضراء، وإطار ذهبي مزدوج، وحقول مسطّرة،
   وختم «معتمد». ومعها لوحة «قوة الفريق الإعلامي»: أعضاؤه وقادته وأعماله وتوزيع فروعه ومؤشر قوته.
   ===================================================================== */

const G = { ink: "#1F3D2E", green: "#3E6350", gold: "#B8912F", goldL: "#D9B45A", paper: "#FBF8F0", line: "#E4DCC6", sub: "#6B6253" };
const TARGET = 12;   // مقاعد قالب الفريق الإعلامي

/** مؤشر القوة من 100: حجم الفريق إلى مقاعده (60) وأعماله المنشورة حتى 60 عملًا (40) */
export const teamPower = (c) => Math.round(Math.min(1, (c.members ?? 0) / TARGET) * 60 + Math.min(1, (c.items ?? 0) / 60) * 40);
const LEVEL = [[85, "متميّز"], [60, "قوي"], [30, "متنامٍ"], [0, "ناشئ"]];

function Row({ k, v, num }) {
  return (
    <div className="flex items-baseline gap-2 border-b py-[5px]" style={{ borderColor: G.line }}>
      <span className="w-[62px] shrink-0 text-[10.5px]" style={{ color: G.sub }}>{k}</span>
      <span className={`min-w-0 flex-1 truncate text-[12.5px] font-semibold ${num ? "num" : ""}`} style={{ color: G.ink }}>{v}</span>
    </div>
  );
}

export default function MediaPressCard({ c, photo, year }) {
  const staff = c.kind === "staff";
  const no = `MT-${staff ? "L" : ""}${String(c.no ?? 1).padStart(3, "0")}`;
  return (
    <div className="mx-auto w-full max-w-[420px] select-none rounded-[10px] p-[5px] shadow-[0_6px_22px_rgba(31,61,46,.16)]"
         style={{ background: G.paper, border: `1.5px solid ${G.green}`, fontFamily: '"IBM Plex Sans Arabic", Tahoma, sans-serif' }}>
      <div className="relative overflow-hidden rounded-[6px]" style={{ border: `1px solid ${G.gold}` }}>
        {/* ترويسة */}
        <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ background: G.ink }}>
          <p className="text-[9.5px] leading-tight text-white/75">وزارة التعليم<br /><b className="text-[10.5px] text-white">مدرسة مكة الثانوية</b></p>
          <div className="text-center">
            <p className="text-[17px] font-bold tracking-[.12em]" style={{ color: G.goldL }}>بطاقة إعلامية</p>
            <p className="text-[8px] font-semibold tracking-[.45em]" style={{ color: `${G.goldL}cc` }} dir="ltr">PRESS · MEDIA TEAM</p>
          </div>
          <img src={iconWhite} alt="" className="h-7 w-7 object-contain" />
        </div>
        <div className="h-[3px]" style={{ background: `linear-gradient(90deg, ${G.gold}, ${G.goldL}, ${G.gold})` }} />

        {/* الجسم */}
        <div className="relative flex gap-3 px-3 pb-3 pt-3"
             style={{ backgroundImage: `repeating-linear-gradient(0deg, transparent 0 22px, ${G.line}55 22px 23px)` }}>
          <div className="shrink-0">
            <div className="grid h-[104px] w-[86px] place-items-center overflow-hidden rounded-[3px] bg-white p-[3px]"
                 style={{ border: `1.5px solid ${G.gold}`, boxShadow: `inset 0 0 0 1px ${G.line}` }}>
              {photo ? <img src={photo} alt="" className="h-full w-full rounded-[2px] object-cover" />
                : <svg viewBox="0 0 48 48" className="h-12 w-12" fill="none" stroke={G.green} strokeWidth="2.2" aria-hidden="true">
                    <rect x="6" y="14" width="36" height="24" rx="4" /><circle cx="24" cy="26" r="7" /><path d="M17 14l3-5h8l3 5" /></svg>}
            </div>
            <p className="num mt-1.5 text-center text-[10px] font-bold tracking-wider" style={{ color: G.green }} dir="ltr">{no}</p>
          </div>
          <div className="min-w-0 flex-1 pb-6">
            <Row k="الاسم" v={c.name} />
            <Row k="الصفة" v={staff ? c.role : "عضو الفريق الإعلامي"} />
            {!staff && <Row k="الفرع" v={c.role} />}
            {c.cls && <Row k="الفصل" v={c.cls} num />}
            <Row k="الإصدار" v={fmtDate(c.joined_at)} num />
          </div>
          {/* ختم «معتمد» */}
          <div className="pointer-events-none absolute -bottom-1 left-3 grid h-[52px] w-[52px] -rotate-12 place-items-center rounded-full opacity-85"
               style={{ border: `1.5px solid ${G.gold}`, boxShadow: `inset 0 0 0 3px ${G.paper}, inset 0 0 0 4px ${G.gold}88` }}>
            <span className="text-center text-[8.5px] font-bold leading-tight" style={{ color: G.gold, background: G.paper }}>معتمد<br /><span className="text-[7px] font-semibold">الفريق الإعلامي</span></span>
          </div>
        </div>

        {/* التذييل */}
        <div className="flex items-center justify-between px-3 py-1.5 text-[9px]" style={{ background: "#F3EEDF", borderTop: `1px solid ${G.gold}66`, color: G.sub }}>
          <span>بوابة مكة الثانوية الرقمية · للاستخدام داخل المدرسة</span>
          <span className="num font-semibold" style={{ color: G.green }} dir="rtl">{year}</span>
        </div>
      </div>
    </div>
  );
}

/** لوحة قوة الفريق الإعلامي بالطراز نفسه */
export function TeamStrength({ c }) {
  const p = teamPower(c);
  const lvl = LEVEL.find(([m]) => p >= m)[1];
  const max = Math.max(1, ...(c.branches ?? []).map((b) => b.n));
  const stats = [[c.members, "عضوًا"], [c.leaders?.length ?? 0, "قائدًا"], [c.items, "عملًا منشورًا"], [c.videos, "مقطعًا"]];
  return (
    <section className="mx-auto w-full max-w-[420px] rounded-[10px] p-[5px]" style={{ background: G.paper, border: `1.5px solid ${G.green}` }}>
      <div className="rounded-[6px] px-4 py-3" style={{ border: `1px solid ${G.gold}` }}>
        <div className="flex items-center gap-2">
          <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${G.gold})` }} />
          <p className="text-[13px] font-bold tracking-[.08em]" style={{ color: G.ink }}>قوة الفريق الإعلامي</p>
          <span className="h-px flex-1" style={{ background: `linear-gradient(270deg, transparent, ${G.gold})` }} />
        </div>

        <div className="mt-3 grid grid-cols-4 divide-x divide-x-reverse text-center" style={{ borderColor: G.line }}>
          {stats.map(([v, t]) => (
            <div key={t} style={{ borderColor: G.line }}>
              <p className="num text-[20px] font-bold leading-none" style={{ color: G.green }}>{v ?? 0}</p>
              <p className="mt-1 text-[10px]" style={{ color: G.sub }}>{t}</p>
            </div>
          ))}
        </div>

        {/* مؤشر القوة */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-[11px]">
            <span style={{ color: G.sub }}>مؤشر القوة</span>
            <span className="font-bold" style={{ color: G.gold }}>{lvl} · <span className="num">{p}</span>/100</span>
          </div>
          <div className="relative mt-1.5 h-[10px] overflow-hidden rounded-full bg-white" style={{ border: `1px solid ${G.line}` }}>
            <div className="h-full rounded-full" style={{ width: `${p}%`, background: `linear-gradient(270deg, ${G.green}, ${G.gold})` }} />
            {[30, 60, 85].map((m) => <i key={m} className="absolute top-0 h-full w-px bg-white/90" style={{ right: `${m}%` }} />)}
          </div>
          <div className="relative mt-1 h-3 text-[9px]" style={{ color: G.sub }}>
            {[[15, "ناشئ"], [45, "متنامٍ"], [72.5, "قوي"], [92.5, "متميّز"]].map(([x, t]) => (
              <span key={t} className="absolute translate-x-1/2 whitespace-nowrap" style={{ right: `${x}%`, fontWeight: t === lvl ? 700 : 400, color: t === lvl ? G.gold : undefined }}>{t}</span>
            ))}
          </div>
        </div>

        {/* الفروع */}
        {(c.branches ?? []).length > 0 && (
          <div className="mt-4 space-y-1.5">
            <p className="text-[11px]" style={{ color: G.sub }}>توزيع الفروع</p>
            {c.branches.map((b) => (
              <div key={b.name} className="flex items-center gap-2 text-[11px]">
                <span className="w-[120px] shrink-0 truncate font-medium" style={{ color: G.ink }}>{b.name}</span>
                <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-white" style={{ border: `1px solid ${G.line}` }}>
                  <span className="block h-full rounded-full" style={{ width: `${(b.n * 100) / max}%`, background: G.green }} />
                </span>
                <span className="num w-5 text-center font-bold" style={{ color: G.green }}>{b.n}</span>
              </div>
            ))}
          </div>
        )}
        {c.leaders?.length > 0 && <p className="mt-3 border-t pt-2 text-center text-[11px]" style={{ borderColor: G.line, color: G.sub }}>
          بقيادة <b style={{ color: G.ink }}>{c.leaders.join("، ")}</b></p>}
      </div>
    </section>
  );
}
