// src/pages/activities/ClassTools.jsx
// أدوات الصف للمعلم على السبورة، لكل فصل ومادة من جدوله (act_my_classes):
// • اختيار طالب عشوائي بلا تكرار، ومنحه نقاطًا في الدوري مباشرة.
// • دوري المادة (أفراد) وكأس المادة (مجموعات): نقاط تتجمع حتى نهاية الفصل الدراسي،
//   فيُتوَّج بطل الدوري وبطل الكأس. بين طلاب الفصل فقط (supabase/activities_2.sql).
// • المؤقت.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { CUP_COLORS } from "../../lib/activities.js";
import Loader from "../../components/Loader.jsx";
import { fullscreen } from "./games/GameHost.jsx";
import ChampionCertificate from "./ChampionCertificate.jsx";

const TOOLS = [
  { key: "pick", label: "🎲 اختيار طالب" },
  { key: "league", label: "🏅 دوري المادة" },
  { key: "cup", label: "🏆 كأس المادة" },
  { key: "timer", label: "⏱ المؤقت" },
];
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const MEDAL = ["🥇", "🥈", "🥉"];
const classLabel = (c) => (c ? `فصل ${GRADE_NAMES[c.grade] ?? ""} ${c.class_no}`.replace(/\s+/g, " ") : "");

export default function ClassTools() {
  const [mine, setMine] = useState(null);
  const [sel, setSel] = useState("");
  const [tool, setTool] = useState("pick");
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState("");
  const [big, setBig] = useState(false);     // عرض على السبورة

  useEffect(() => {
    supabase.rpc("act_my_classes").then(({ data, error }) => {
      if (error) setErr(/act_my_classes/.test(error.message) ? "أدوات الصف لم تُفعَّل بعد (supabase/activities_2.sql)." : error.message);
      setMine(data ?? []);
      if (data?.length) setSel(`${data[0].class_id}|${data[0].subject_id}`);
    });
  }, []);
  const [cid, sid] = sel.split("|");
  const cur = mine?.find((m) => m.class_id === cid && m.subject_id === sid);

  const load = useCallback(() => {
    if (!cid) return;
    supabase.rpc("act_league_board", { p_class: cid, p_subject: sid })
      .then(({ data, error }) => { if (error) setErr(error.message); else { setErr(""); setBoard(data); } });
  }, [cid, sid]);
  useEffect(() => { setBoard(null); load(); }, [load]);

  const addPoints = async (row, points, reason) => {
    const { error } = await supabase.from("subject_league_points").insert({ class_id: cid, subject_id: sid, points, reason: reason || null, ...row });
    if (error) { setErr(error.message); return; }
    load();
  };

  if (!mine) return <Loader compact />;
  if (!mine.length) return <p className="card p-6 text-center text-sm text-muted">{err || "لا توجد فصول في جدولك الدراسي."}</p>;

  const content = !board ? <Loader compact /> : (
    <>
      {tool === "pick" && <Picker students={board.students} big={big} onPoints={(s, p) => addPoints({ student_id: s.id }, p, "اختيار عشوائي")} />}
      {tool === "league" && <League students={board.students} big={big} cert={{ subject: cur?.subject, classLabel: classLabel(cur) }} onPoints={(s, p, r) => addPoints({ student_id: s.id }, p, r)} />}
      {tool === "cup" && <Cup board={board} cid={cid} sid={sid} big={big} reload={load} cert={{ subject: cur?.subject, classLabel: classLabel(cur) }} onPoints={(g, p, r) => addPoints({ group_id: g.id }, p, r)} />}
      {tool === "timer" && <Timer big={big} />}
    </>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="field w-auto text-sm" value={sel} onChange={(e) => setSel(e.target.value)}>
          {mine.map((m) => <option key={`${m.class_id}|${m.subject_id}`} value={`${m.class_id}|${m.subject_id}`}>
            {GRADE_NAMES[m.grade] ?? ""} — {m.class_no} · {m.subject}</option>)}
        </select>
        <div className="flex max-w-full gap-1 overflow-x-auto">
          {TOOLS.map((t) => <button key={t.key} type="button" onClick={() => setTool(t.key)}
            className={`shrink-0 rounded-pill px-3 py-1.5 text-xs font-semibold ${tool === t.key ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted"}`}>{t.label}</button>)}
        </div>
        <button type="button" className="btn-ghost mr-auto py-1.5 text-sm" onClick={() => setBig(true)}>عرض على السبورة</button>
      </div>
      {err && <p className="rounded-card bg-absent/10 px-3 py-2 text-sm text-absent">{err}</p>}
      {big ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[#F4F7F5]" dir="rtl">
          <div className="flex items-center gap-2 border-b border-line bg-white px-4 py-2">
            <p className="flex-1 font-bold text-ink">{TOOLS.find((t) => t.key === tool)?.label} · {cur?.subject} · فصل {cur?.class_no}</p>
            <button type="button" className="btn-ghost py-1 text-sm" onClick={fullscreen}>ملء الشاشة</button>
            <button type="button" className="btn-ghost py-1 text-sm" onClick={() => { setBig(false); if (document.fullscreenElement) document.exitFullscreen?.(); }}>خروج</button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">{content}</div>
        </div>
      ) : content}
    </div>
  );
}

function PointButtons({ onPoints, size = "sm" }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[1, 2, 3, 5].map((p) => <button key={p} type="button" onClick={() => onPoints(p)}
        className={`num rounded-pill bg-mint-deep font-bold text-white ${size === "lg" ? "px-5 py-2 text-lg" : "px-3 py-1 text-xs"}`}>+{p}</button>)}
      <button type="button" onClick={() => onPoints(-1)}
        className={`num rounded-pill border border-absent/40 font-bold text-absent ${size === "lg" ? "px-5 py-2 text-lg" : "px-3 py-1 text-xs"}`}>−1</button>
    </div>
  );
}

function Picker({ students, big, onPoints }) {
  const [left, setLeft] = useState(() => shuffle(students.map((s) => s.id)));
  const [cur, setCur] = useState(null);
  const [spin, setSpin] = useState(null);
  const [given, setGiven] = useState(false);
  const byId = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);

  const go = () => {
    let pool = left.length ? left : shuffle(students.map((s) => s.id));
    const id = pool[0];
    pool = pool.slice(1);
    let k = 0;
    const t = setInterval(() => {
      setSpin(students[Math.floor(Math.random() * students.length)]?.name);
      if (++k > 14) { clearInterval(t); setSpin(null); setCur(byId[id]); setLeft(pool); setGiven(false); }
    }, 70);
  };
  return (
    <div className={`card space-y-5 p-6 text-center ${big ? "mx-auto max-w-3xl" : ""}`}>
      <p className={`min-h-[3.5rem] font-bold text-ink ${big ? "text-6xl" : "text-4xl"}`}>{spin ?? cur?.name ?? "؟"}</p>
      <button type="button" className={`btn-primary ${big ? "px-10 py-4 text-2xl" : "px-8 py-3 text-lg"}`} onClick={go} disabled={!!spin || !students.length}>🎲 اختر طالبًا</button>
      {cur && !spin && (given ? <p className="text-sm text-present">أُضيفت النقاط إلى الدوري ✓</p> : (
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-muted">نقاط في دوري المادة:</p>
          <PointButtons size={big ? "lg" : "sm"} onPoints={(p) => { onPoints(cur, p); setGiven(true); }} />
        </div>
      ))}
      <p className="text-xs text-muted">بقي <bdi className="num">{left.length}</bdi> لم يُختاروا في هذه الجولة</p>
    </div>
  );
}

function League({ students, big, cert, onPoints }) {
  const [who, setWho] = useState(null);
  const [print, setPrint] = useState(false);
  const [reason, setReason] = useState("");
  const rows = [...students].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, "ar"));
  const rank = (i) => (i > 0 && rows[i].points === rows[i - 1].points ? null : i);
  return (
    <div className={`grid gap-3 ${big ? "" : "lg:grid-cols-[1fr_300px]"}`}>
      <div className="card overflow-hidden">
        <table className={`w-full ${big ? "text-xl" : "text-sm"}`}>
          <thead><tr className="border-b border-line bg-canvas text-right text-xs text-muted"><th className="w-12 p-2">#</th><th className="p-2">الطالب</th><th className="p-2 text-center">النقاط</th></tr></thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={s.id} onClick={() => !big && setWho(s)}
                  className={`border-b border-line/50 ${!big ? "cursor-pointer hover:bg-canvas" : ""} ${who?.id === s.id ? "bg-mint-tint" : ""}`}>
                <td className="num p-2 text-center">{s.points > 0 && i < 3 ? MEDAL[i] : rank(i) != null ? i + 1 : ""}</td>
                <td className="p-2 font-medium text-ink">{s.name}</td>
                <td className="num p-2 text-center font-bold text-ink">{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!big && (
        <div className="card h-fit space-y-3 p-4">
          <p className="text-sm font-semibold text-ink">منح نقاط</p>
          {who ? (
            <>
              <p className="text-base font-bold text-mint-deep">{who.name}</p>
              <input className="field text-sm" placeholder="السبب (اختياري): إجابة متميزة، واجب…" value={reason} onChange={(e) => setReason(e.target.value)} />
              <PointButtons onPoints={(p) => { onPoints(who, p, reason); setReason(""); }} />
            </>
          ) : <p className="text-xs text-muted">اضغط اسم الطالب في الجدول.</p>}
          <p className="border-t border-line pt-2 text-[11px] leading-relaxed text-faint">
            النقاط تتجمع حتى نهاية الفصل الدراسي، وصاحب أعلى مجموع بطل دوري المادة.
          </p>
          {rows[0]?.points > 0 && (
            <button type="button" className="btn-ghost w-full text-sm" onClick={() => setPrint(true)}>🏆 شهادة بطل الدوري</button>
          )}
        </div>
      )}
      {print && <ChampionCertificate kind="league" names={rows.filter((s) => s.points === rows[0].points).map((s) => s.name)}
                                     points={rows[0].points} {...cert} onClose={() => setPrint(false)} />}
    </div>
  );
}

function Cup({ board, cid, sid, big, cert, reload, onPoints }) {
  const [print, setPrint] = useState(false);
  const groups = [...board.groups].sort((a, b) => b.points - a.points);
  const [edit, setEdit] = useState(!board.groups.length);
  const [n, setN] = useState(4);
  const [busy, setBusy] = useState(false);
  const names = Object.fromEntries(board.students.map((s) => [s.id, s.name]));

  const make = async () => {
    if (board.groups.length && !window.confirm("إعادة تكوين المجموعات؟ تُحذف المجموعات الحالية ونقاطها.")) return;
    setBusy(true);
    if (board.groups.length) await supabase.from("subject_cup_groups").delete().in("id", board.groups.map((g) => g.id));
    const ids = shuffle(board.students.map((s) => s.id));
    const rows = Array.from({ length: n }, (_, k) => ({ class_id: cid, subject_id: sid, name: `المجموعة ${k + 1}`, color: CUP_COLORS[k % CUP_COLORS.length], sort: k,
      members: ids.filter((_, j) => j % n === k) }));
    await supabase.from("subject_cup_groups").insert(rows);
    setBusy(false); setEdit(false); reload();
  };
  const rename = async (g, name) => { await supabase.from("subject_cup_groups").update({ name }).eq("id", g.id); reload(); };

  return (
    <div className="space-y-3">
      {!big && (edit ? (
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <label className="text-xs text-muted">عدد المجموعات
            <input type="number" min={2} max={8} className="field num mt-1 w-24" value={n} onChange={(e) => setN(Math.max(2, Math.min(8, Number(e.target.value) || 2)))} />
          </label>
          <button type="button" className="btn-primary" disabled={busy} onClick={make}>تكوين المجموعات عشوائيًا</button>
          {board.groups.length > 0 && <button type="button" className="btn-ghost" onClick={() => setEdit(false)}>إلغاء</button>}
          <p className="w-full text-[11px] text-faint">مجموعات ثابتة طوال الفصل الدراسي، ونقاطها تتجمع، والأعلى بطل كأس المادة.</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="text-xs text-muted underline" onClick={() => setEdit(true)}>إعادة تكوين المجموعات</button>
          {groups[0]?.points > 0 && <button type="button" className="btn-ghost py-1 text-sm" onClick={() => setPrint(true)}>🏆 شهادات بطل الكأس ({groups[0].name})</button>}
        </div>
      ))}
      {print && <ChampionCertificate kind="cup" group={groups[0].name} names={groups[0].members.map((m) => names[m]).filter(Boolean)}
                                     points={groups[0].points} {...cert} onClose={() => setPrint(false)} />}
      <div className={`grid gap-3 ${big ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
        {groups.map((g, i) => (
          <div key={g.id} className="card space-y-2 p-4" style={{ borderTop: `6px solid ${g.color ?? "#3E6350"}` }}>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{g.points > 0 && i < 3 ? MEDAL[i] : ""}</span>
              {big ? <p className="flex-1 text-2xl font-bold text-ink">{g.name}</p>
                : <input className="min-w-0 flex-1 bg-transparent text-lg font-bold text-ink outline-none" defaultValue={g.name} onBlur={(e) => e.target.value !== g.name && rename(g, e.target.value)} />}
              <span className={`num font-bold text-ink ${big ? "text-5xl" : "text-3xl"}`}>{g.points}</span>
            </div>
            <PointButtons size={big ? "lg" : "sm"} onPoints={(p) => onPoints(g, p)} />
            {!big && <p className="text-[11px] leading-relaxed text-muted">{g.members.map((m) => names[m]).filter(Boolean).join("، ")}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Timer({ big }) {
  const [total, setTotal] = useState(300);
  const [left, setLeft] = useState(300);
  const [run, setRun] = useState(false);
  useEffect(() => {
    if (!run || left <= 0) return;
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [run, left]);
  const set = (s) => { setTotal(s); setLeft(s); setRun(false); };
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  return (
    <div className="card space-y-5 p-6 text-center">
      <p dir="ltr" className={`num font-bold ${left === 0 ? "animate-pulse text-absent" : left <= 10 ? "text-absent" : "text-ink"} ${big ? "text-[10rem] leading-none" : "text-7xl"}`}>{mm}:{ss}</p>
      <div className="mx-auto h-2 max-w-md overflow-hidden rounded-pill bg-canvas"><div className="h-full bg-mint-deep transition-all" style={{ width: `${(left / total) * 100}%` }} /></div>
      <div className="flex flex-wrap justify-center gap-2">
        {[1, 3, 5, 10, 15].map((m) => <button key={m} type="button" className="btn-ghost" onClick={() => set(m * 60)}>{m} د</button>)}
      </div>
      <div className="flex justify-center gap-2">
        <button type="button" className="btn-primary px-8" onClick={() => setRun((r) => !r)} disabled={left === 0}>{run ? "إيقاف" : "ابدأ"}</button>
        <button type="button" className="btn-ghost" onClick={() => set(total)}>إعادة</button>
      </div>
    </div>
  );
}
