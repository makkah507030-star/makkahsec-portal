"""Mix voice-over lines over SFX + music with ducking. usage: python3 vo_mix.py <sfx_script> <out.wav> <at:file> ..."""
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, resample_poly
src = open(sys.argv[1], encoding="utf-8").read()
exec(src.split("# ——— background music")[0])            # builds `mix` (SFX only), SR, n
out = sys.argv[2]
voice = np.zeros(n)
for spec in sys.argv[3:]:
    at, f = spec.split(":", 1)
    sr, v = wavfile.read(f); v = v.astype(float) / 32768
    if v.ndim > 1: v = v.mean(1)
    if sr != SR: v = resample_poly(v, SR, sr)
    v = sosfilt(butter(2, 80, 'highpass', fs=SR, output='sos'), v)
    v = v / (np.sqrt((v[np.abs(v) > .02] ** 2).mean()) + 1e-9) * 10 ** (-17 / 20)   # speech RMS ≈ -17 dBFS
    v = np.tanh(v * 1.6) / 1.6                                                  # gentle peak control
    i = int(float(at) * SR); v = v[: n - i]; voice[i:i+len(v)] += v
# ducking envelope from the voice
w = int(.02 * SR); act = np.convolve((np.abs(voice) > .01).astype(float), np.ones(w) / w, 'same') > 0
env = np.where(act, 10 ** (-10 / 20), 1.0)
k = int(.25 * SR); env = np.convolve(np.pad(env, k, mode='edge'), np.ones(k) / k, 'same')[k:-k]
_sr, m = wavfile.read("music-bed-52.wav"); m = m.astype(float) / 32767
m = m[:n] if len(m) >= n else np.pad(m, ((0, n - len(m)), (0, 0)))
x = mix * np.minimum(1, env + .35)[:, None] + m * .16 * env[:, None] + np.stack([voice, voice], 1)
fo = int(1.0 * SR); x[-fo:] *= np.linspace(1, 0, fo)[:, None]
x = x / np.abs(x).max() * .9
wavfile.write(out, SR, (x * 32767).astype(np.int16)); print("vo mix ok", out)
