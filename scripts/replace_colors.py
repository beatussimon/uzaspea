import os
import re

def replace_colors(directory):
    count_blue = 0
    count_slate = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts', '.css')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Replace blue- with brand-
                new_content, c1 = re.subn(r'blue-(\d+)', r'brand-\1', content)
                # Replace slate- with gray-
                new_content, c2 = re.subn(r'slate-(\d+)', r'gray-\1', new_content)
                
                if c1 > 0 or c2 > 0:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    count_blue += c1
                    count_slate += c2

    print(f"Replaced {count_blue} occurrences of blue-")
    print(f"Replaced {count_slate} occurrences of slate-")

if __name__ == '__main__':
    replace_colors(r'\\wsl.localhost\Ubuntu\home\bea\uzaspea\frontend\src')
