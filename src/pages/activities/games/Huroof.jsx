// src/pages/activities/games/Huroof.jsx
// لعبة «حروف» على السبورة: شبكة سداسية 5×5 من الحروف وفريقان. يختار الفريق حرفًا، فيقرأ
// المعلم سؤالًا جوابه يبدأ بالحرف؛ من يجيب يلوّن الخلية. يفوز الأخضر إن وصل اليمين باليسار،
// والأحمر إن وصل الأعلى بالأسفل. الأسئلة من بيانات البطاقة: { letters: { "أ": [{q, a}], … } }.
import { useMemo, useState } from "react";
import { schoolHuroof } from "../../../lib/schoolQuestions.js";

const N = 5;
const TEAMS = {
  g: { name: "الفريق الأخضر", goal: "يصل اليمين باليسار", fill: "#3E9A63", text: "text-[#2E7A4B]" },
  r: { name: "الفريق الأحمر", goal: "يصل الأعلى بالأسفل", fill: "#C0473E", text: "text-[#A3372F]" },
};
const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const label = (l) => (l === "ه" ? "هـ" : l);

// جيران الخلية في شبكة سداسية صفوفها الفردية مزاحة
const neighbors = (r, c) => (r % 2 === 0
  ? [[r - 1, c - 1], [r - 1, c], [r, c - 1], [r, c + 1], [r + 1, c - 1], [r + 1, c]]
  : [[r - 1, c], [r - 1, c + 1], [r, c - 1], [r, c + 1], [r + 1, c], [r + 1, c + 1]])
  .filter(([a, b]) => a >= 0 && a < N && b >= 0 && b < N);

function won(owner, team) {
  const start = [], seen = new Set();
  for (let i = 0; i < N; i++) {
    const [r, c] = team === "g" ? [i, 0] : [0, i];
    if (owner[r * N + c] === team) start.push([r, c]);
  }
  while (start.length) {
    const [r, c] = start.pop();
    const k = r * N + c;
    if (seen.has(k)) continue;
    seen.add(k);
    if ((team === "g" && c === N - 1) || (team === "r" && r === N - 1)) return true;
    neighbors(r, c).forEach(([a, b]) => owner[a * N + b] === team && start.push([a, b]));
  }
  return false;
}

export default function Huroof({ data, school }) {
  // أسئلة البطاقة، ومعها «من مدرستي»: معلمون وإداريون تبدأ أسماؤهم بالحرف
  const bank = useMemo(() => {
    const b = { ...(data?.letters ?? {}) }, s = schoolHuroof(school);
    Object.entries(s).forEach(([l, qs]) => { if (b[l]) b[l] = [...qs, ...b[l]]; });
    return b;
  }, [data, school]);
  const all = useMemo(() => Object.keys(bank).filter((l) => bank[l]?.length), [bank]);
  const newBoard = () => shuffle(all).slice(0, N * N);
  const [letters, setLetters] = useState(newBoard);
  const [owner, setOwner] = useState(() => Array(N * N).fill(null));
  const [pick, setPick] = useState(null);        // { i, q, a }
  const [show, setShow] = useState(false);
  const [usedQ, setUsedQ] = useState({});        // الحرف ← أرقام الأسئلة المستعملة
  const [score, setScore] = useState({ g: 0, r: 0 });
  const winner = won(owner, "g") ? "g" : won(owner, "r") ? "r" : null;

  const ask = (i) => {
    const l = letters[i], qs = bank[l] ?? [];
    const used = usedQ[l] ?? [];
    // سؤال المدرسة غير المستعمل يُفضَّل في أغلب المرات، للحماس
    const free = qs.map((q, k) => k).filter((k) => !used.includes(k));
    const sch = free.filter((k) => qs[k].school);
    let idx = sch.length && Math.random() < 0.6 ? sch[0] : free.find((k) => !qs[k].school) ?? free[0] ?? -1;
    if (idx < 0) idx = Math.floor(Math.random() * qs.length);
    setUsedQ((u) => ({ ...u, [l]: [...(u[l] ?? []), idx] }));
    setPick({ i, ...qs[idx] }); setShow(false);
  };
  const give = (team) => {
    const next = [...owner]; next[pick.i] = team;
    setOwner(next); setPick(null);
    if (team && won(next, team)) setScore((s) => ({ ...s, [team]: s[team] + 1 }));
  };
  const newRound = () => { setLetters(newBoard()); setOwner(Array(N * N).fill(null)); setPick(null); };

  if (all.length < N * N) return <p className="p-6 text-center text-muted">أسئلة اللعبة غير مكتملة في هذه البطاقة.</p>;

  const s = 52, w = Math.sqrt(3) * s, pad = 22;
  const W = N * w + w / 2 + pad * 2, H = (N - 1) * 1.5 * s + 2 * s + pad * 2;
  const pts = (cx, cy) => Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 90);
    return `${cx + (s - 2) * Math.cos(a)},${cy + (s - 2) * Math.sin(a)}`;
  }).join(" ");

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1fr_340px]">
      <div className="card p-3" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto max-h-[72vh] w-full">
          <rect x={4} y={pad} width={8} height={H - 2 * pad} rx={4} fill={TEAMS.g.fill} />
          <rect x={W - 12} y={pad} width={8} height={H - 2 * pad} rx={4} fill={TEAMS.g.fill} />
          <rect x={pad} y={4} width={W - 2 * pad} height={8} rx={4} fill={TEAMS.r.fill} />
          <rect x={pad} y={H - 12} width={W - 2 * pad} height={8} rx={4} fill={TEAMS.r.fill} />
          {letters.map((l, i) => {
            const r = Math.floor(i / N), c = i % N;
            const cx = pad + w / 2 + c * w + (r % 2) * (w / 2), cy = pad + s + r * 1.5 * s;
            const o = owner[i], sel = pick?.i === i;
            return (
              <g key={i} onClick={() => !o && !winner && ask(i)} className={o || winner ? "" : "cursor-pointer"}>
                <polygon points={pts(cx, cy)} fill={o ? TEAMS[o].fill : sel ? "#FFE9A8" : "#FFFFFF"}
                         stroke={sel ? "#C99A1E" : "#CBD5CF"} strokeWidth={sel ? 4 : 2} />
                <text x={cx} y={cy + 13} textAnchor="middle" fontSize="38" fontWeight="700"
                      fill={o ? "#fff" : "#1E2B24"} style={{ fontFamily: "IBM Plex Sans Arabic, Tahoma" }}>{label(l)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-center">
          {["g", "r"].map((t) => (
            <div key={t} className="card p-3">
              <p className={`text-sm font-bold ${TEAMS[t].text}`}>{TEAMS[t].name}</p>
              <p className="num text-4xl font-bold text-ink">{score[t]}</p>
              <p className="text-[11px] text-muted">{TEAMS[t].goal}</p>
            </div>
          ))}
        </div>
        {winner ? (
          <div className="card space-y-3 p-5 text-center">
            <p className="text-4xl">🏆</p>
            <p className={`text-2xl font-bold ${TEAMS[winner].text}`}>فاز {TEAMS[winner].name}!</p>
            <button type="button" className="btn-primary w-full" onClick={newRound}>جولة جديدة</button>
          </div>
        ) : pick ? (
          <div className="card space-y-3 p-4">
            <p className="text-sm text-muted">حرف <b className="text-2xl text-ink">{label(letters[pick.i])}</b></p>
            {pick.school && <p className="w-fit animate-pulse rounded-pill bg-[#FFE9A8] px-3 py-0.5 text-sm font-bold text-[#7A5A00]">🏫 سؤال من مدرستي</p>}
            <p className="text-xl font-bold leading-relaxed text-ink">{pick.q}</p>
            {show ? <p className="rounded-card bg-mint-tint px-3 py-2 text-xl font-bold text-mint-deep">{pick.a}</p>
              : <button type="button" className="btn-ghost w-full" onClick={() => setShow(true)}>إظهار الإجابة</button>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="rounded-pill py-2 font-bold text-white" style={{ background: TEAMS.g.fill }} onClick={() => give("g")}>للأخضر</button>
              <button type="button" className="rounded-pill py-2 font-bold text-white" style={{ background: TEAMS.r.fill }} onClick={() => give("r")}>للأحمر</button>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => ask(pick.i)}>سؤال آخر</button>
              <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => setPick(null)}>إلغاء</button>
            </div>
          </div>
        ) : (
          <div className="card space-y-2 p-4 text-sm leading-relaxed text-muted">
            <p className="font-bold text-ink">طريقة اللعب</p>
            <p>يختار الفريق حرفًا، فاضغطه واقرأ السؤال. جواب السؤال يبدأ بالحرف المختار. أول فريق يجيب صحيحًا يأخذ الخلية.</p>
            <p>الأخضر يحاول وصل اليمين باليسار، والأحمر وصل الأعلى بالأسفل، ويسدّ كلٌّ طريق الآخر.</p>
            <button type="button" className="btn-ghost w-full" onClick={newRound}>خلط الحروف</button>
          </div>
        )}
      </div>
    </div>
  );
}
