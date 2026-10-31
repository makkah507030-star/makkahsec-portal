// كتل محتوى الدليل فوق مكوّنات التقارير (Box وmr-table وmr-high)
import { Box } from "../../../src/components/report/ReportKit.jsx";

/* نص الدليل بخط البوابة وحده (IBM Plex Sans Arabic): الرموز التي ليست في الخط (← ✓ ✕ ✎ ↺ ↻) تُرسم
   أيقونات بلون النص بدل أن يأخذها المتصفح من خط آخر، والأرقام المركّبة (رموز المؤشرات والنسب) تُعزل
   اتجاهًا من اليسار بعنصر num لا بمحارف تحكم خفية ليست في الخط. */
const SVG = { "←": "M19 12H5m6-6-6 6 6 6", "✓": "m5 12 5 5 9-10", "✕": "M6 6l12 12M18 6 6 18", "✎": "M4 20h4L19 9l-4-4L4 16v4z",
  "↺": "M4 4v6h6M5.5 15a7 7 0 1 0 1.7-7.2L4 10", "↻": "M20 4v6h-6M18.5 15a7 7 0 1 1-1.7-7.2L20 10",
  // رموز الأزرار في خطوات الإجراءات (رموز تعبيرية في البوابة) أيقونات خطية بلون النص
  "👍": "M7 10v10H4V10h3zm0 0 4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 16.8 20H7",
  "👎": "M7 14V4H4v10h3zm0 0 4 7a2 2 0 0 0 2-2v-4h5a2 2 0 0 0 2-2.3l-1.2-7A2 2 0 0 0 16.8 4H7",
  "🏫": "M3 21h18M5 21V10l7-5 7 5v11M9 21v-5h6v5M12 5V2h3",
  "🪟": "M4 4h16v16H4zM12 4v16M4 12h16",
  "📝": "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  "📷": "M4 7h4l2-3h4l2 3h4v12H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" };
const RE = /(\d+(?:-\d+){3}|[+-]?\d+(?:[.,]\d+)?\s?%|[←✓✕✎↺↻]|👍|👎|🏫|🪟|📝|📷)\uFE0F?/gu;
export const txt = (t) => (typeof t !== "string" ? t : t.split(RE).map((x, i) => (i % 2 === 0 ? x
  : SVG[x] ? <svg key={i} className="g-sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label={x}><path d={SVG[x]} /></svg>
  : <span key={i} className="num">{x}</span>)));

export const P = ({ children }) => <div className="g-p">{children}</div>;
export const UL = ({ items }) => <ul className="g-ul">{items.map((t, i) => <li key={i}><span>{txt(t)}</span></li>)}</ul>;
export const OL = ({ items }) => <ol className="g-ol">{items.map((t, i) => <li key={i}><span>{txt(t)}</span></li>)}</ol>;
export const Card = ({ icon = "list", title, aside, tint, children }) => <Box icon={icon} title={title} aside={aside} tint={tint}>{children}</Box>;
export const Note = ({ children }) => <div className="g-note">{children}</div>;
export const Chips = ({ items }) => <div className="g-chips">{items.map((t) => <span key={t}>{t}</span>)}</div>;
/* جدول: cols = [[العنوان، عرضه أو null، محاذاة c]]، rows = [[خلايا]] */
export const Table = ({ cols, rows }) => (
  <table className="mr-table">
    <thead><tr>{cols.map(([t, w, a]) => <th key={t} className={a ?? ""} style={w ? { width: w } : undefined}>{t}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cols[j][2] ?? ""}>{txt(c)}</td>)}</tr>)}</tbody>
  </table>
);
/* جدول طويل يُقسَّم كتلًا بعدد صفوف، فيوزّعها الترقيم على الصفحات وتتكرر الترويسة */
export const tableBlocks = (cols, rows, per = 10) => {
  const out = [];
  for (let i = 0; i < rows.length; i += per) out.push(<Table cols={cols} rows={rows.slice(i, i + per)} />);
  return out;
};
