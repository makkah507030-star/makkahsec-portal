"""Softer, more polished sound design: logo bloom, air swishes, soft taps + light music (reused)."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile
D = 52.0

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

