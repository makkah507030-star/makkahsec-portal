# scripts/normalize-db-url.py
# يصحّح رابط قاعدة البيانات SUPABASE_DB_URL قبل استخدامه: كلمة مرور فيها
# رموز مثل @ أو # أو / تُفسد الرابط، والقوسان [ ] من قالب Supabase قد يبقيان.
# يفصل عند آخر @، ويزيل القوسين، ويرمّز كلمة المرور. يطبع الرابط المصحّح.
import os
import sys
from urllib.parse import quote, unquote

raw = os.environ.get("SUPABASE_DB_URL", "").strip()
try:
    scheme, rest = raw.split("://", 1)
    cred, host = rest.rsplit("@", 1)
    user, password = cred.split(":", 1)
except ValueError:
    sys.exit("SUPABASE_DB_URL ليس بالشكل: postgresql://USER:PASSWORD@HOST:PORT/DB")

password = password.strip()
if password.startswith("[") and password.endswith("]"):
    password = password[1:-1]
password = unquote(password)  # إن كانت مرمّزة مسبقًا لا تُرمَّز مرتين
print(f"{scheme}://{user.strip()}:{quote(password, safe='')}@{host.strip()}")
