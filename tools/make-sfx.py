#!/usr/bin/env python3
"""
Generate the sample sound effects in assets/audio/.

These are deliberately plain: 22.05 kHz, 8-bit, mono, a few kilobytes each, in
the spirit of the pixel art. Run this to regenerate them, or just replace the
.wav files with your own — the game only cares about the filenames listed in
js/audio/manifest.js.

    python3 tools/make-sfx.py
"""
import math, os, random, struct, wave

RATE = 22050
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "audio")

def write(name, samples):
    data = bytearray()
    for s in samples:
        v = int(max(-1.0, min(1.0, s)) * 127) + 128
        data.append(v)
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(1); w.setframerate(RATE)
        w.writeframes(bytes(data))
    print("  %-12s %5.2fs  %4d bytes" % (name, len(samples)/RATE, os.path.getsize(path)))

def env(i, n, attack=0.01, release=0.6):
    a = int(n*attack) or 1
    r = int(n*release) or 1
    if i < a: return i/a
    if i > n-r: return max(0.0, (n-i)/r)
    return 1.0

def square(p):  return 1.0 if (p % 1.0) < 0.5 else -1.0
def saw(p):     return 2.0*(p % 1.0) - 1.0
def tri(p):     x = (p % 1.0); return 4*x-1 if x < 0.5 else 3-4*x
def sine(p):    return math.sin(2*math.pi*p)

def tone(dur, f0, f1=None, wave_fn=square, attack=0.01, release=0.6, noise=0.0, gain=0.7, vibrato=0.0):
    n = int(RATE*dur); f1 = f0 if f1 is None else f1
    out = []; phase = 0.0
    for i in range(n):
        t = i/n
        f = f0*(1-t) + f1*t
        if vibrato: f *= 1.0 + vibrato*math.sin(2*math.pi*14*i/RATE)
        phase += f/RATE
        v = wave_fn(phase)
        if noise: v = v*(1-noise) + random.uniform(-1, 1)*noise
        out.append(v*env(i, n, attack, release)*gain)
    return out

def mix(*layers):
    n = max(len(l) for l in layers)
    out = [0.0]*n
    for l in layers:
        for i, v in enumerate(l): out[i] += v
    return [max(-1.0, min(1.0, v)) for v in out]

def seq(*parts):
    out = []
    for p in parts: out.extend(p)
    return out

os.makedirs(OUT, exist_ok=True)
random.seed(7)
print("writing sample sfx to assets/audio/")

# the slingshot release
write("launch", mix(tone(0.22, 180, 700, square, 0.005, 0.7, gain=0.55),
                    tone(0.10, 900, 1500, tri, 0.002, 0.9, gain=0.25)))
# landing on a ledge
write("land",   mix(tone(0.13, 150, 90, sine, 0.002, 0.85, gain=0.8),
                    tone(0.06, 400, 200, square, 0.001, 0.9, noise=0.6, gain=0.35)))
# sticking to a wall or ceiling
write("cling",  tone(0.09, 900, 620, tri, 0.002, 0.9, gain=0.45))
# eating a food token
write("eat",    seq(tone(0.055, 880, 880, square, 0.004, 0.5, gain=0.4),
                    tone(0.085, 1320, 1400, square, 0.004, 0.7, gain=0.4)))
# a bounce pad
write("bounce", tone(0.24, 260, 760, sine, 0.004, 0.75, gain=0.6, vibrato=0.05))
# glancing damage: hitting a wall hard, clipping a hazard
write("hurt",   mix(tone(0.26, 420, 170, saw, 0.002, 0.8, gain=0.55),
                    tone(0.12, 300, 120, square, 0.001, 0.9, noise=0.5, gain=0.3)))
# the run ending
write("die",    seq(tone(0.16, 520, 380, square, 0.003, 0.3, gain=0.55),
                    tone(0.16, 380, 250, square, 0.003, 0.3, gain=0.5),
                    tone(0.42, 250, 70,  square, 0.003, 0.75, noise=0.15, gain=0.5)))
# ui click
write("click",  tone(0.045, 1250, 1100, square, 0.002, 0.8, gain=0.3))
# starting a run
write("start",  seq(tone(0.09, 523, 523, tri, 0.004, 0.5, gain=0.45),
                    tone(0.09, 659, 659, tri, 0.004, 0.5, gain=0.45),
                    tone(0.20, 880, 880, tri, 0.004, 0.7, gain=0.5)))
# a score that made the board
write("fanfare", seq(tone(0.10, 659, 659, square, 0.004, 0.4, gain=0.4),
                     tone(0.10, 784, 784, square, 0.004, 0.4, gain=0.4),
                     tone(0.10, 988, 988, square, 0.004, 0.4, gain=0.4),
                     tone(0.36, 1319, 1319, tri, 0.004, 0.75, gain=0.5)))
