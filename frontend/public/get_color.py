import os
from PIL import Image
from collections import Counter

for file in os.listdir('.'):
    if file.endswith('.png'):
        try:
            img = Image.open(file).convert('RGBA')
            pixels = list(img.getdata())
            # filter out transparent, black, white, and grays
            valid_pixels = []
            for r, g, b, a in pixels:
                if a > 200:
                    if max(r, g, b) - min(r, g, b) > 30: # Not grayscale
                        valid_pixels.append((r, g, b))
            
            if valid_pixels:
                counter = Counter(valid_pixels)
                most_common = counter.most_common(1)[0][0]
                hex_color = '#%02x%02x%02x' % most_common
                print(f'{file}: {hex_color} {most_common}')
        except Exception as e:
            pass
