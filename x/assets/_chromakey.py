# Chroma-key green seal renders -> transparent, trimmed PNGs.
import numpy as np
from PIL import Image
import os

SRC = os.path.expanduser("~/.codex/generated_images/019eab40-8561-70e1-ad9c-2b5c1c1ee538")
JOBS = [
    # (source file, output name)  -- seal-3 = labyrinth, seal-2 = glitch dissolve
    ("ig_0a6a5f6d2dccc54f016a28010f267c8191aa37a12cfe769a56.png", "seal-01.png"),
    ("ig_0a6a5f6d2dccc54f016a280069122c8191ad9fd76a07836b02.png", "seal-02.png"),
]
OUT = os.path.dirname(__file__)

for src, name in JOBS:
    im = Image.open(os.path.join(SRC, src)).convert("RGB")
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    greenness = g - np.maximum(r, b)              # high where pure green bg
    # alpha: 1 where red ink, 0 where green; soft ramp between
    alpha = np.clip((60.0 - greenness) / 50.0, 0.0, 1.0)
    # kill green spill on kept pixels: clamp green channel to red
    g2 = np.minimum(g, np.maximum(r, b))
    rgb = np.stack([r, g2, b], axis=-1)
    rgba = np.dstack([rgb, alpha * 255.0]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")
    # trim to content bbox using alpha
    bbox = out.split()[-1].getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(os.path.join(OUT, name))
    print(name, out.size)
print("done")
