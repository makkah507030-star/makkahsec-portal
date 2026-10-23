// api/site-metrics.js — الدالة نفسها من netlify/functions على Vercel (انظر api/_adapter.js)
import { handler } from "../netlify/functions/site-metrics.js";
import { toVercel } from "./_adapter.js";

export default toVercel(handler);
