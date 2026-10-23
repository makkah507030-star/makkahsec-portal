// api/referral-assets.js — الدالة نفسها من netlify/functions على Vercel (انظر api/_adapter.js)
import { handler } from "../netlify/functions/referral-assets.js";
import { toVercel } from "./_adapter.js";

export default toVercel(handler);
