// api/dfile-doc.js — الدالة نفسها من netlify/functions على Vercel (انظر api/_adapter.js)
import { handler } from "../netlify/functions/dfile-doc.js";
import { toVercel } from "./_adapter.js";

export default toVercel(handler);
