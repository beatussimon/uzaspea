import os
import re
import shutil

TEMPLATES_DIR = "marketplace/templates"

def optimize_html(content: str) -> str:
    original = content

    # 1. Lazy-load images (HTML-only, safe)
    content = re.sub(
        r'<img(?![^>]*loading=)([^>]*?)>',
        r'<img loading="lazy"\1>',
        content
    )

    # 2. Defer external JS safely
    content = re.sub(
        r'<script src="([^"]+\.js)"></script>',
        r'<script src="\1" defer></script>',
        content
    )

    # 3. Remove jQuery CDN (Bootstrap 5 safe)
    content = re.sub(
        r'\n?\s*<script src="https://code\.jquery\.com/jquery-[^"]+"></script>',
        '',
        content
    )

    return content if content != original else original


def main():
    for root, _, files in os.walk(TEMPLATES_DIR):
        for file in files:
            if not file.endswith(".html"):
                continue

            path = os.path.join(root, file)

            with open(path, "r", encoding="utf-8") as f:
                content = f.read()

            optimized = optimize_html(content)

            if optimized != content:
                shutil.copy2(path, path + ".bak")

                with open(path, "w", encoding="utf-8") as f:
                    f.write(optimized)

                print(f"✔ Optimized safely: {path}")
            else:
                print(f"– Skipped: {path}")

    print("\n✅ SAFE optimization complete (no template logic touched)")

if __name__ == "__main__":
    main()
