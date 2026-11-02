#!/usr/bin/env python3
import os
from PIL import Image

pub_dir = "/home/bea/uzaspea/frontend/public"

# 1. Resize checkmark badges to 64x64
for fname in ['gray_checkmark.png', 'gold_checkmark.png', 'greeen_ckeckmark.png']:
    p = os.path.join(pub_dir, fname)
    if os.path.exists(p):
        img = Image.open(p).convert("RGBA")
        img = img.resize((64, 64), Image.Resampling.LANCZOS)
        img.save(p, "PNG", optimize=True)
        size_kb = os.path.getsize(p) / 1024
        print(f"Resized {fname} -> {size_kb:.1f} KB")

# 2. Generate favicon-32x32.png and apple-touch-icon.png
fav_src = os.path.join(pub_dir, "favicon.png")
if os.path.exists(fav_src):
    img = Image.open(fav_src).convert("RGBA")
    
    fav32 = img.resize((32, 32), Image.Resampling.LANCZOS)
    fav32_path = os.path.join(pub_dir, "favicon-32x32.png")
    fav32.save(fav32_path, "PNG", optimize=True)
    print(f"Created favicon-32x32.png ({os.path.getsize(fav32_path)/1024:.1f} KB)")
    
    apple_icon = img.resize((180, 180), Image.Resampling.LANCZOS)
    apple_path = os.path.join(pub_dir, "apple-touch-icon.png")
    apple_icon.save(apple_path, "PNG", optimize=True)
    print(f"Created apple-touch-icon.png ({os.path.getsize(apple_path)/1024:.1f} KB)")

# 3. Generate logo-128.webp
logo_src = os.path.join(pub_dir, "logo.png")
if os.path.exists(logo_src):
    img = Image.open(logo_src).convert("RGBA")
    logo128 = img.resize((128, 128), Image.Resampling.LANCZOS)
    logo128_path = os.path.join(pub_dir, "logo-128.webp")
    logo128.save(logo128_path, "WEBP", quality=85)
    print(f"Created logo-128.webp ({os.path.getsize(logo128_path)/1024:.1f} KB)")

# 4. Remove unreferenced kariakoo images
unreferenced_kariakoo = [
    "kariakoo_dawn_dark.jpg",
    "kariakoo_daytime.png",
    "kariakoo_dusk.jpg",
    "kariakoo_midnight.jpg",
    "kariakoo_nightscape.png",
    "kariakoo_sunrise.jpg",
    "kariakoo_sunset.jpg",
]
for fname in unreferenced_kariakoo:
    p = os.path.join(pub_dir, fname)
    if os.path.exists(p):
        os.remove(p)
        print(f"Removed unreferenced {fname}")

# 5. Remove stale duplicate public/locales
locales_dir = os.path.join(pub_dir, "locales")
if os.path.exists(locales_dir):
    import shutil
    shutil.rmtree(locales_dir)
    print("Removed stale duplicate public/locales directory")

print("OPTIMIZE_ASSETS_OK")
