# توليد أصوات العرض: قصيرة وهادئة، تُولَّد هنا فلا حقوق ولا ملفات خارجية
import math, struct, wave, os

RATE = 22050


def tone(freqs, length, vol=0.32, decay=5.0, gap=0.0):
    """نغمات متتابعة؛ لكل نغمة جرس ناعم (أساسية + توافقية خفيفة) وتلاشٍ أسّي"""
    out = []
    for f in freqs:
        n = int(RATE * length)
        for i in range(n):
            t = i / RATE
            env = math.exp(-decay * t) * min(1.0, t / 0.008)  # بداية ناعمة بلا طقطقة
            s = math.sin(2 * math.pi * f * t) + 0.25 * math.sin(4 * math.pi * f * t)
            out.append(vol * env * s / 1.25)
        out += [0.0] * int(RATE * gap)
    return out


def save(name, samples):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sounds", f"{name}.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s)) * 32767)) for s in samples))


save("timeup", tone([1318.5, 1046.5, 1318.5, 1046.5], 0.3, vol=0.30, decay=5.0))  # جرس منبّه مزدوج
save("correct", tone([784.0, 1174.7], 0.22, vol=0.30, decay=7.0))                  # نغمتان صاعدتان
save("wrong", tone([311.1, 261.6], 0.25, vol=0.28, decay=6.0))                     # نغمتان هابطتان منخفضتان
