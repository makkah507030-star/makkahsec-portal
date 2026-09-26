"""Synthesised sound design for the motion videos (no samples, no music)."""
import sys, numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile
from build import FLYERS
from motion import G1_IN, G1_OUT, G2_IN, G2_OUT, STAG

SR, DUR = 48000, 30.0
rng = np.random.default_rng(7)

def t_(d): return np.arange(int(d * SR)) / SR
def env(n, a, r):  # attack / release in seconds, exponential tail
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / r)
    return e

def whoosh(d=.9, lo=300, hi=3500, peak=.55, gain=.5):
    n = int(d * SR); noise = rng.standard_normal(n)
    out = np.zeros(n); seg = 256; zi = np.zeros((2, 2))
    for i in range(0, n, seg):  # swept band-pass
        p = i / n; f = lo + (hi - lo) * np.sin(np.pi * min(1, p / (2 * peak))) ** 2 if p < peak else hi - (hi - lo) * ((p - peak) / (1 - peak))
        sos = butter(2, [max(80, f * .6), min(SR / 2 - 100, f * 1.6)], 'bandpass', fs=SR, output='sos')
        out[i:i+seg], zi = sosfilt(sos, noise[i:i+seg], zi=zi)
    t = np.arange(n) / n
    e = np.where(t < peak, (t / peak) ** 2, ((1 - t) / (1 - peak)) ** 1.5)
    return out * e * gain / (np.abs(out).max() + 1e-9)

def pop(f0=720, gain=.35, d=.14):
    t = t_(d); f = f0 * (1 + 1.2 * np.exp(-t * 40))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .002, .035) * gain

def tick(gain=.18):
    n = int(.05 * SR); x = rng.standard_normal(n)
    x = sosfilt(butter(2, 2500, 'highpass', fs=SR, output='sos'), x)
    return x * env(n, .001, .008) * gain / np.abs(x).max()

def boom(gain=.6):
    t = t_(1.4); f = 55 + 60 * np.exp(-t * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), .01, .45) * gain

def rise(d=1.0, gain=.18):
    t = t_(d); x = np.zeros_like(t)
    for k, f in enumerate([523.25, 659.25, 783.99, 1046.5]):
        x += np.sin(2 * np.pi * f * t * (1 + .002 * np.sin(2 * np.pi * 5 * t))) / (k + 1.5)
    e = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2
    return x * e * gain

def chime(gain=.32):
    t = t_(1.6); x = np.zeros_like(t)
    for st, f in [(0, 1318.5), (.11, 1760.0)]:
        m = t >= st; tt = t[m] - st
        x[m] += (np.sin(2*np.pi*f*tt) + .35*np.sin(2*np.pi*f*2.01*tt)) * np.exp(-tt * 5)
    return x * gain

def sparkle(gain=.12):
    t = t_(1.2); x = np.zeros_like(t)
    for i, f in enumerate([2093, 2637, 3136, 3951, 4186]):
        st = i * .07; m = t >= st; tt = t[m] - st
        x[m] += np.sin(2*np.pi*f*tt) * np.exp(-tt * 9)
    return x * gain

def resolve(gain=.16):
    t = t_(2.4); x = np.zeros_like(t)
    for f in [261.63, 392.0, 523.25, 659.25]:
        x += np.sin(2*np.pi*f*t) + .2*np.sin(2*np.pi*2*f*t)
    return x * env(len(t), .04, .8) * gain / 4

def build(key):
    n = int(DUR * SR); L = np.zeros(n); R = np.zeros(n)
    def put(at, s, pan=0.0):
        i = int(at * SR); s = s[: max(0, n - i)]
        L[i:i+len(s)] += s * (1 - max(0, pan)); R[i:i+len(s)] += s * (1 + min(0, pan))
    # intro
    put(.1, boom()); put(.15, rise(1.2)); put(1.0, whoosh(.7, 600, 2500, .6, .18))
    # scene wipes (whoosh peaks where the band crosses the frame)
    for w in (2.7, 18.95, 22.55): put(w, whoosh(.95, 250, 4200, .5, .55))
    # hero
    put(3.45, pop(640, .32)); put(3.75, whoosh(.5, 900, 3000, .5, .14), .2); put(4.0, whoosh(.5, 900, 3000, .5, .14), -.2)
    put(4.6, tick(.14)); put(7.6, tick(.12))
    # features
    k = len(FLYERS[key]["features"]); half = (k + 1) // 2
    for grp_in, grp_out, cnt in ((G1_IN, G1_OUT, half), (G2_IN, G2_OUT, k - half)):
        for i in range(cnt):
            put(grp_in + i * STAG, whoosh(.35, 1200, 4500, .5, .12), .35)
            put(grp_in + i * STAG + .15, pop(820 + 60 * i, .22))
        put(grp_out, whoosh(.6, 3000, 600, .4, .18), -.4)
    # phone + notification
    put(19.55, whoosh(1.0, 200, 1800, .55, .3)); put(20.5, chime()); put(20.9, whoosh(.5, 900, 3000, .5, .12))
    # CTA
    put(23.3, whoosh(.5, 900, 3000, .5, .14))
    for i, at in enumerate((23.75, 24.05, 24.35)): put(at, pop(700 + 110 * i, .24), .2 - .2 * i)
    put(24.9, pop(520, .4)); put(24.95, resolve()); put(26.1, sparkle()); put(27.9, sparkle(.09))
    # master: gentle fades + soft limiter
    st = np.stack([L, R], 1)
    fade = np.ones(n); f = int(.05 * SR); fade[:f] = np.linspace(0, 1, f); fo = int(1.2 * SR); fade[-fo:] = np.linspace(1, 0, fo)
    st *= fade[:, None]
    st = np.tanh(st * 1.4) / np.tanh(1.4) * .85
    wavfile.write(f"sfx-{key}.wav", SR, (st * 32767).astype(np.int16))

for key in (sys.argv[1:] or FLYERS):
    build(key); print("sfx", key)
