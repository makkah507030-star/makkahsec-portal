"""Softer, more polished sound design: logo bloom, air swishes, soft taps + light music (reused)."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile
from motion_teacher import DUR as D, WIPES, S3, S4, S5, S6, S7

SR = 48000; rng = np.random.default_rng(11)
n = int(D * SR)
T = lambda d: np.arange(int(d * SR)) / SR

def ir(decay=1.6, pre=.012):
    t = T(decay); e = np.exp(-t * 6.9 / decay)
    l = rng.standard_normal(len(t)) * e; r = rng.standard_normal(len(t)) * e
    lp = butter(1, 5000, 'lowpass', fs=SR, output='sos')
    l, r = sosfilt(lp, l), sosfilt(lp, r)
    z = np.zeros(int(pre * SR))
    return np.concatenate([z, l]) / np.abs(l).sum() * 18, np.concatenate([z, r]) / np.abs(r).sum() * 18
IR = ir()
def verb(x, wet=.35):
    l = fftconvolve(x, IR[0])[:len(x) + len(IR[0])]; r = fftconvolve(x, IR[1])[:len(x) + len(IR[1])]
    dry = np.pad(x, (0, len(l) - len(x)))
    return np.stack([dry * (1 - wet) + l * wet, dry * (1 - wet) + r * wet], 1)

def pink(m):
    w = np.fft.rfft(rng.standard_normal(m)); f = np.arange(len(w)); f[0] = 1
    return np.fft.irfft(w / np.sqrt(f), m)

def swish(d=.8, gain=.28, lo=500, hi=2600, pan=(.7, -.7)):
    """Soft air swish: pink noise, rising/falling low-pass, panned across, with room."""
    m = int(d * SR); x = pink(m); x /= np.abs(x).max()
    out = np.zeros(m); zi = np.zeros((2, 2)); seg = 256
    for i in range(0, m, seg):
        p = i / m; fc = lo + (hi - lo) * np.sin(np.pi * p) ** 1.5
        sos = butter(2, [120, fc], 'bandpass', fs=SR, output='sos')
        out[i:i+seg], zi = sosfilt(sos, x[i:i+seg], zi=zi)
    t = np.linspace(0, 1, m); e = np.sin(np.pi * t) ** 2.2
    s = out * e; s = s / np.abs(s).max() * gain
    st = verb(s, .3); k = len(st); pp = np.linspace(pan[0], pan[1], k)
    st[:, 0] *= np.clip(1 - pp, 0, 1.4) / 1.4 + .3; st[:, 1] *= np.clip(1 + pp, 0, 1.4) / 1.4 + .3
    return st

def bell(f, d=2.4, g=.1):
    t = T(d); x = (np.sin(2*np.pi*f*t) + .35*np.sin(2*np.pi*2.01*f*t)*np.exp(-t*3) + .12*np.sin(2*np.pi*3.02*f*t)*np.exp(-t*6))
    return x * np.minimum(1, t / .004) * np.exp(-t * 2.2) * g

def logo_bloom(g=1.0):
    """Warm glassy chord bloom + soft sub, with a short airy lift — no pitch-drop boom."""
    m = int(3.2 * SR); x = np.zeros(m)
    for i, f in enumerate([523.25, 659.25, 783.99, 1174.66]):          # C5 E5 G5 D6, gently strummed
        s = bell(f, 2.8, .085); o = int(i * .07 * SR); x[o:o+len(s)] += s[:m - o]
    t = T(.9); sub = np.sin(2*np.pi*65.4*t) * np.minimum(1, t / .03) * np.exp(-t * 5) * .22   # soft C2 body
    x[:len(sub)] += sub
    air = pink(int(1.2 * SR)); air = sosfilt(butter(2, [2500, 9000], 'bandpass', fs=SR, output='sos'), air)
    ta = np.linspace(0, 1, len(air)); air = air / np.abs(air).max() * np.exp(-ta * 5) * np.minimum(1, ta / .05) * .05
    x[:len(air)] += air
    return verb(x * g, .42)

def tap(f=1400, g=.07):
    t = T(.35); x = (np.sin(2*np.pi*f*t) + .25*np.sin(2*np.pi*2.4*f*t)) * np.minimum(1, t / .002) * np.exp(-t * 26) * g
    return verb(x, .25)

def chime2(g=.09):
    m = int(2 * SR); x = np.zeros(m)
    for i, f in enumerate([1318.5, 1760.0]):
        s = bell(f, 1.8, g); o = int(i * .1 * SR); x[o:o+len(s)] += s[:m - o]
    return verb(x, .35)

def sparkle2(g=.05):
    m = int(1.8 * SR); x = np.zeros(m)
    for i, f in enumerate([2093, 2637, 3136, 3951]):
        s = bell(f, 1.2, g); o = int(i * .06 * SR); x[o:o+len(s)] += s[:m - o]
    return verb(x, .4)

mix = np.zeros((n, 2))
def put(at, st, g=1.0):
    if st.ndim == 1: st = np.stack([st, st], 1)
    i = int(at * SR); st = st[: max(0, n - i)] * g; mix[i:i+len(st)] += st

# intro + closing logo
put(.12, logo_bloom(1.35)); put(S7 + .1, logo_bloom(1.2))
# scene wipes: the band crosses right→left; centre the swish on the crossing
for w in WIPES: put(w + .05, swish(.9, .26))
# hero and titles
put(3.45, tap(1180, .08)); put(3.8, swish(.55, .1, 700, 2200))
for i in range(4): put(5.3 + i * .28, tap(1250, .04))
for t0 in (S3, S4, S5, S6): put(t0, tap(1180, .08)); put(t0 + .3, swish(.55, .1, 700, 2200))
# content
put(S3 + .7, swish(.8, .14, 300, 1600, (-.6, .4)))
for i in range(4): put(S3 + 1.35 + i * 1.55, swish(.4, .06, 900, 3000)); put(S3 + 1.45 + i * 1.55, tap(1400 + 70 * i, .055))
put(S3 + 8.1, tap(1250, .045))
put(S4 + .7, swish(.8, .14, 300, 1600)); put(S4 + 2.1, tap(1250, .07)); put(S4 + 2.5, chime2())
for i in range(4): put(S4 + 3.75 + i * 1.2, tap(1250, .042))
put(S5 + .7, swish(.8, .14, 300, 1600)); put(S5 + 2.0, sparkle2())
for i in range(4): put(S5 + 3.35 + i * 1.2, tap(1250, .042))
for i in range(6): put(S6 + 1.1 + i * .45, tap(1250, .036))
put(S6 + 4.0, tap(1250, .042))
put(S7 + 1.8, sparkle2(.04))

# light music bed from the previous mix (music part only), re-synthesised the same way
OUTWAV = "sfx-teacher-tools-pro.wav"
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
