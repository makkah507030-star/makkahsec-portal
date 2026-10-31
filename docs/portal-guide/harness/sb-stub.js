// بديل supabase لبيئة الدليل: لا اتصال ولا بيانات
const q = () => { const x = new Proxy(() => x, { get: (_, k) => (k === "then" ? (r) => Promise.resolve({ data: [], error: null }).then(r) : x), apply: () => x }); return x; };
export const supabase = { from: q, rpc: async () => ({ data: null, error: null }), channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: null }), getPublicUrl: () => ({ data: {} }) }) } };
export const isConfigured = false;
export const idToEmail = (x) => x;
export const initialPassword = () => "";
export const normalizeLogin = (x) => x;
