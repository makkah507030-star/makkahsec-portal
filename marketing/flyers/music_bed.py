"""Five synthesized background-music candidates (royalty-free)."""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile
SR = 48000; rng = np.random.default_rng(5)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
def T(d): return np.arange(int(d * SR)) / SR
def lp(x, fc): return sosfilt(butter(2, fc, 'lowpass', fs=SR, output='sos'), x)
def hp(x, fc): return sosfilt(butter(2, fc, 'highpass', fs=SR, output='sos'), x)
def adsr(n, a, d, s, r, dur):
    t = np.arange(n) / SR; e = np.where(t < a, t / a, np.where(t < a + d, 1 - (1 - s) * (t - a) / d, s))
    return e * np.clip((dur + r - t) / r, 0, 1) * (t < dur + r)
def ir(decay):
    t = T(decay); e = np.exp(-t * 6.9 / decay)
    return [lp(rng.standard_normal(len(t)) * e, 6000) for _ in range(2)]
def verb(x, decay=2.2, wet=.3):
    L, R = ir(decay); s = np.abs(L).sum() / 14
    l = fftconvolve(x, L)[:len(x)] / s; r = fftconvolve(x, R)[:len(x)] / s
    return np.stack([x * (1 - wet) + l * wet, x * (1 - wet) + r * wet], 1)

def piano(f, dur, g=.2):                 # soft felt-piano-ish tone
    t = T(dur + 1.5); x = sum(np.sin(2*np.pi*f*k*t) * np.exp(-t*(1.6+k*1.2)) / k**1.4 for k in range(1, 7))
    return lp(x * np.minimum(1, t / .006) * g, 3500)
def pluck(f, g=.12):
    t = T(1.0); x = (np.sin(2*np.pi*f*t) + .5*np.sin(2*np.pi*2*f*t)*np.exp(-t*12) + .2*np.sign(np.sin(2*np.pi*f*t))*np.exp(-t*25))
    return lp(x * np.exp(-t * 7) * np.minimum(1, t / .002) * g, 4200)
def mallet(f, g=.14):
    t = T(1.4); x = np.sin(2*np.pi*f*t) + .3*np.sin(2*np.pi*4*f*t)*np.exp(-t*30) + .12*np.sin(2*np.pi*10*f*t)*np.exp(-t*60)
    return x * np.exp(-t * 4.5) * np.minimum(1, t / .002) * g
def pad(freqs, dur, g=.05, bright=1800, a=1.2):
    t = T(dur + 1.2); x = np.zeros(len(t))
    for f in freqs:
        for det in (-.004, 0, .004):
            ph = rng.uniform(0, 2*np.pi)
            x += (np.sin(2*np.pi*f*(1+det)*t+ph) + .35*np.sin(2*np.pi*2*f*(1+det)*t+ph)) / 3
    return lp(x * adsr(len(t), a, .5, .85, 1.2, dur) * g, bright)
def strings(freqs, dur, g=.05):
    t = T(dur + 1.5); x = np.zeros(len(t))
    for f in freqs:
        for det in (-.006, -.002, .002, .006):
            vib = 1 + .003*np.sin(2*np.pi*5.2*t + rng.uniform(0, 6))
            x += 2*((f*(1+det)*vib*t) % 1) - 1                 # saw
    return lp(x / 4 * adsr(len(t), 1.4, .6, .9, 1.5, dur) * g, 2200)
def kick(g=.35):
    t = T(.4); f = 48 + 70*np.exp(-t*30); return np.sin(2*np.pi*np.cumsum(f)/SR) * np.exp(-t*9) * g
def shaker(g=.03):
    x = hp(rng.standard_normal(int(.09*SR)), 6000); t = np.arange(len(x))/SR
    return x * np.exp(-t*50) * np.minimum(1, t/.004) * g
def bass(f, dur, g=.12):
    t = T(dur); return lp(np.sin(2*np.pi*f*t) + .3*np.sin(2*np.pi*2*f*t), 400) * adsr(len(t), .02, .2, .8, .15, dur - .15) * g

def render(D, build, name, wet=.3, decay=2.2):
    n = int(D * SR); buf = np.zeros(n)
    def put(at, s):
        i = int(at * SR); s = s[: max(0, n - i)]; buf[i:i+len(s)] += s
    build(put)
    st = verb(buf, decay, wet)
    e = np.ones(n); fi, fo = int(1.5*SR), int(2.5*SR); e[:fi] = np.linspace(0, 1, fi); e[-fo:] = np.linspace(1, 0, fo)
    st *= e[:, None]; st = st / np.abs(st).max() * .85
    wavfile.write(f"music-{name}.wav", SR, (st * 32767).astype(np.int16)); print(name)

D = 52.0
# 2 — modern tech: pluck arpeggiator 112 bpm, soft kick + shaker, Am–F–C–G
def b2(put):
    beat = 60/112; prog = [[45,57,60,64],[41,57,60,65],[48,55,60,64],[43,55,59,62]]
    t = 0; k = 0
    while t < D:
        ch = prog[k % 4]; put(t, pad([mid(m) for m in ch[1:]], 4*beat, .03, 1400))
        for j in range(4): put(t + j*beat, kick(.22)); put(t + j*beat + beat/2, shaker(.035))
        for j in range(8): put(t + j*beat/2, bass(mid(ch[0]), beat/2, .07))
        seq = [ch[1], ch[2], ch[3], ch[2]+12, ch[3], ch[2], ch[1]+12, ch[2]]
        for j, m in enumerate(seq * 2): put(t + j*beat/4, pluck(mid(m+12), .055))
        t += 4*beat; k += 1
render(D, b2, "bed-52", .22, 1.6)
