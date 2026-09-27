from sfx_lib import *
from motion_teacher import WIPES, S3, S4, S5, S6, S7
mix = np.zeros((n, 2))
def put(at, st, g=1.0):
    if st.ndim == 1: st = np.stack([st, st], 1)
    i = int(at * SR); st = st[: max(0, n - i)] * g; mix[i:i+len(st)] += st
put(.12, logo_bloom(1.35)); put(S7 + .1, logo_bloom(1.2))
for w in WIPES: put(w + .05, swish(.9, .26))
put(3.45, tap(1180, .08)); put(3.8, swish(.55, .1, 700, 2200))
for i in range(4): put(5.3 + i * .28, tap(1250, .04))
for t0 in (S3, S4, S5, S6): put(t0, tap(1180, .08)); put(t0 + .3, swish(.55, .1, 700, 2200))
# 01 schedule
put(S3 + .7, swish(.8, .14, 300, 1600)); put(S3 + 2.0, tap(1250, .07)); put(S3 + 2.4, chime2(.07))
for i in range(4): put(S3 + 3.55 + i * 1.2, tap(1250, .042))
# 02 quizzes — numbered steps
put(S4 + .7, swish(.8, .14, 300, 1600))
for i in range(4): put(S4 + 1.9 + i * 1.5, swish(.4, .06, 900, 3000)); put(S4 + 2.0 + i * 1.5, tap(1400 + 70 * i, .055))
put(S4 + 3.0, swish(1.2, .07, 300, 1400))
# 03 record & results
put(S5 + .7, swish(.8, .14, 300, 1600)); put(S5 + 1.9, tap(1250, .07)); put(S5 + 2.3, chime2(.07))
for i in range(4): put(S5 + 3.15 + i * 1.2, tap(1250, .042))
# 04 services
for i in range(6): put(S6 + 1.1 + i * .45, tap(1250, .036))
put(S6 + 4.0, tap(1250, .042))
put(S7 + 1.8, sparkle2(.04))
OUTWAV = "sfx-guardian-tools.wav"
# ——— background music: sample 2 (modern tech), kept as a quiet bed ———
_sr, _m = wavfile.read("music-bed-52.wav"); _m = _m.astype(float) / 32767
_m = _m[:n] if len(_m) >= n else np.pad(_m, ((0, n - len(_m)), (0, 0)))
_w0, _w1 = int(6 * SR), int(7 * SR)          # a stretch with music only
def _mixed(g):
    x = mix + _m * g; fo = int(1.0 * SR); x[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return x / np.abs(x).max() * .89
g = .3
for _ in range(12):
    x = _mixed(g); r = 20 * np.log10(np.sqrt((x[_w0:_w1] ** 2).mean()) + 1e-9)
    g *= 10 ** ((-26.5 - r) / 20)
x = _mixed(g)
wavfile.write(OUTWAV, SR, (x * 32767).astype(np.int16))
print("audio ok", OUTWAV, round(r, 1))
