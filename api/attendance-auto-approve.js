// api/attendance-auto-approve.js — الدالة نفسها من netlify/functions على Vercel (انظر api/_adapter.js)
import { handler } from "../netlify/functions/attendance-auto-approve.js";
import { toVercel } from "./_adapter.js";

export default toVercel(handler, { cron: true });
