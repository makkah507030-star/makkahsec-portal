// api/deputy-signature.js — الدالة نفسها من netlify/functions على Vercel (انظر api/_adapter.js)
import { handler } from "../netlify/functions/deputy-signature.js";
import { toVercel } from "./_adapter.js";

export default toVercel(handler);
