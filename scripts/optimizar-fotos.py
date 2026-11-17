#!/usr/bin/env python3
"""Genera variantes optimizadas (webp + jpg) de las fotos de uploads/ en .optimizadas/.
Requiere Pillow (requirements.txt). El build las usa con srcset si existen; si no, usa el original."""
import os, sys
try:
    from PIL import Image, ImageOps
except ImportError:
    # Sin Pillow el sitio se publica igual, pero con las fotos originales (más pesadas).
    print('AVISO: falta Pillow (pip install -r requirements.txt). Se publican las fotos originales sin optimizar.', file=sys.stderr)
    sys.exit(0)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, OUT = os.path.join(ROOT, 'uploads'), os.path.join(ROOT, '.optimizadas')
WIDTHS = [480, 800, 1200, 1600]
os.makedirs(OUT, exist_ok=True)
n = 0
for f in sorted(os.listdir(SRC)):
    base, ext = os.path.splitext(f)
    if ext.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
        continue
    src = os.path.join(SRC, f)
    im = None
    for w in WIDTHS:
        webp, jpg = os.path.join(OUT, f'{base}-{w}.webp'), os.path.join(OUT, f'{base}-{w}.jpg')
        if os.path.exists(webp) and os.path.getmtime(webp) >= os.path.getmtime(src):
            continue
        if im is None:
            im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
        r = im.copy()
        if r.width > w:
            r = r.resize((w, round(r.height * w / r.width)), Image.LANCZOS)
        r.save(webp, 'WEBP', quality=80, method=6)
        r.save(jpg, 'JPEG', quality=82, optimize=True, progressive=True)
        n += 1
print(f'{n} variantes generadas en .optimizadas/')
