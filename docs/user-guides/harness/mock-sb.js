// بديل supabase للقطات الأدلة: بيانات ثابتة من fixtures.js، بلا اتصال.
// تُطبَّق مرشحات المساواة (eq/in/is/match) على الحقول الموجودة في الصفوف، وتُتجاهل مرشحات المدى والترتيب.
import { USERS, TABLES, RPC } from "./fixtures.js";

const qs = new URLSearchParams(location.search);
if (qs.get("as")) localStorage.setItem("guide_as", qs.get("as"));
const as = localStorage.getItem("guide_as") || "teacher";
const me = USERS[as] ?? USERS.teacher;
const session = { user: { id: me.id, email: me.username + "@makkahsec.com" }, access_token: "guide", expires_at: 4e9 };
const tbl = (t) => { const v = TABLES[t]; return typeof v === "function" ? v(me) : (v ?? []); };

window.__q = window.__q || {};
function query(table) {
  window.__q[table] = (window.__q[table] || 0) + 1;
  const st = { f: [], one: false, maybe: false, head: false, count: false, write: null };
  const run = () => {
    if (st.write) return { data: st.one || st.maybe ? (Array.isArray(st.write) ? st.write[0] : st.write) : [].concat(st.write), error: null, count: 1 };
    let rows = tbl(table);
    for (const fn of st.f) rows = rows.filter(fn);
    if (st.head) return { data: null, error: null, count: rows.length };
    if (st.one || st.maybe) return { data: rows[0] ?? null, error: null };
    return { data: rows, error: null, count: rows.length };
  };
  const has = (r, k) => r && Object.prototype.hasOwnProperty.call(r, k);
  const api = {
    select(_c, o) { if (o?.head) st.head = true; if (o?.count) st.count = true; return p; },
    eq(k, v) { st.f.push((r) => !has(r, k) || r[k] === v || String(r[k]) === String(v)); return p; },
    in(k, a) { st.f.push((r) => !has(r, k) || (a ?? []).map(String).includes(String(r[k]))); return p; },
    is(k, v) { st.f.push((r) => !has(r, k) || (v === null ? r[k] == null : r[k] === v)); return p; },
    match(o) { Object.entries(o).forEach(([k, v]) => api.eq(k, v)); return p; },
    single() { st.one = true; return p; }, maybeSingle() { st.maybe = true; return p; },
    insert(v) { st.write = v; return p; }, upsert(v) { st.write = v; return p; },
    update(v) { st.write = v; return p; }, delete() { st.write = []; return p; },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  const p = new Proxy(api, { get: (o, k) => (k in o ? o[k] : () => p) });
  return p;
}

const chan = { on() { return chan; }, subscribe(cb) { cb?.("SUBSCRIBED"); return chan; }, unsubscribe() {}, send() {} };
const file = { data: { signedUrl: "/fonts/x.png", publicUrl: "/fonts/x.png", path: "x" }, error: null };
export const supabase = {
  from: query,
  rpc: async (name, args) => { window.__q['rpc:' + name] = 1; const v = RPC[name]; return { data: typeof v === "function" ? v(me, args) : (v ?? null), error: null }; },
  channel: () => chan, removeChannel() {}, removeAllChannels() {},
  auth: {
    getSession: async () => ({ data: { session } }), getUser: async () => ({ data: { user: session.user } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({}), signInWithPassword: async () => ({ data: { session }, error: null }), updateUser: async () => ({ error: null }),
  },
  storage: { from: () => ({ createSignedUrl: async () => file, createSignedUrls: async () => ({ data: [] }), getPublicUrl: () => file,
    upload: async () => file, list: async () => ({ data: [] }), remove: async () => ({}), download: async () => ({ data: null }) }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
};
export const isConfigured = true;
export const idToEmail = (x) => `${x}@makkahsec.com`;
export const initialPassword = (x) => x;
export const normalizeLogin = (x) => x;
export const ME = me;
