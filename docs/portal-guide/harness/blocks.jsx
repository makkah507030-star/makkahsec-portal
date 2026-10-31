// كتل محتوى الدليل فوق مكوّنات التقارير (Box وmr-table وmr-high)
import { Box } from "../../../src/components/report/ReportKit.jsx";
import { bidi } from "../../../src/lib/bidi.js";

export const P = ({ children }) => <div className="g-p">{children}</div>;
export const UL = ({ items }) => <ul className="g-ul">{items.map((t, i) => <li key={i}><span>{typeof t === "string" ? bidi(t) : t}</span></li>)}</ul>;
export const OL = ({ items }) => <ol className="g-ol">{items.map((t, i) => <li key={i}><span>{bidi(t)}</span></li>)}</ol>;
export const Card = ({ icon = "list", title, aside, tint, children }) => <Box icon={icon} title={title} aside={aside} tint={tint}>{children}</Box>;
export const Note = ({ children }) => <div className="g-note">{children}</div>;
export const Chips = ({ items }) => <div className="g-chips">{items.map((t) => <span key={t}>{t}</span>)}</div>;
/* جدول: cols = [[العنوان، عرضه أو null، محاذاة c]]، rows = [[خلايا]] */
export const Table = ({ cols, rows }) => (
  <table className="mr-table">
    <thead><tr>{cols.map(([t, w, a]) => <th key={t} className={a ?? ""} style={w ? { width: w } : undefined}>{t}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={cols[j][2] ?? ""}>{typeof c === "string" ? bidi(c) : c}</td>)}</tr>)}</tbody>
  </table>
);
/* جدول طويل يُقسَّم كتلًا بعدد صفوف، فيوزّعها الترقيم على الصفحات وتتكرر الترويسة */
export const tableBlocks = (cols, rows, per = 10) => {
  const out = [];
  for (let i = 0; i < rows.length; i += per) out.push(<Table cols={cols} rows={rows.slice(i, i + per)} />);
  return out;
};
