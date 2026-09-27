"""vo_fit.py in.wav out.wav max_seconds — shrink inner pauses to 0.22s, then atempo only if still too long."""
import sys, subprocess, numpy as np, scipy.io.wavfile as w, imageio_ffmpeg
src, dst, maxs = sys.argv[1], sys.argv[2], float(sys.argv[3])
sr, x = w.read(src); x = x.astype(np.float32)
env = np.convolve(np.abs(x), np.ones(int(sr*.02))/int(sr*.02), 'same')
quiet = env < 10**(-40/20)*32768
# find quiet runs
runs, i, n = [], 0, len(x)
while i < n:
    if quiet[i]:
        j = i
        while j < n and quiet[j]: j += 1
        runs.append((i, j)); i = j
    else: i += 1
first = next((j for a, j in runs if a == 0), 0); last = next((a for a, j in runs if j == n), n)
x = x[max(0, first-int(.05*sr)):min(n, last+int(.12*sr))]; off = max(0, first-int(.05*sr))
keep = int(.22*sr); out, cur = [], 0
for a, b in runs:
    a -= off; b -= off
    if a <= 0 or b >= len(x) or b-a <= keep: continue
    out.append(x[cur:a+keep//2]); cur = b-keep//2
out.append(x[cur:]); y = np.concatenate(out)
w.write(dst, sr, y.astype(np.int16)); L = len(y)/sr
if L > maxs:
    t = min(L/maxs, 1.08)
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-y', '-i', dst, '-af', f'atempo={t:.3f}', dst+'.tmp.wav'], check=True)
    subprocess.run(['mv', dst+'.tmp.wav', dst]); print(f'{src}: {len(x)/sr:.2f}s -> {L:.2f}s (pauses) -> {L/t:.2f}s atempo {t:.3f}')
else: print(f'{src}: {len(x)/sr:.2f}s -> {L:.2f}s (pauses only)')
