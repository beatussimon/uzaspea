import os
import re
import shutil

TEMPLATES_DIR = "marketplace/templates"

def optimize_html(content: str) -> str:
    original = content

    # 1. Lazy-load images (safe)
    content = re.sub(
        r'<img(?![^>]*loading=)([^>]*?)>',
        r'<img loading="lazy"\1>',
        content
    )

    # 2. Defer JS (non-inline only)
    content = re.sub(
        r'<script src="([^"]+\.js)"></script>',
        r'<script src="\1" defer></script>',
        content
    )

    # 3. Remove jQuery CDN (Bootstrap 5+ safe)
    content = re.sub(
        r'\s*<script src="https://code\.jquery\.com/jquery-[^"]+"></script>',
        '',
        content
    )

    # 4. Hide newsletter for logged-in users (only once)
    if "Subscribe to Newsletter" in content and "{% if not user.is_authenticated %}" not in content:
        content = content.replace(
            '<div class="card mb-4">',
            '{% if not user.is_authenticated %}\n<div class="card mb-4">',
            1
        )
        content = content.replace(
            '</div>\n</div>\n</div>',
            '</div>\n</div>\n</div>\n{% endif %}',
            1
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
                # Backup
                shutil.copy2(path, path + ".bak")

                with open(path, "w", encoding="utf-8") as f:
                    f.write(optimized)

                print(f"✔ Optimized: {path}")
            else:
                print(f"– Skipped (no change): {path}")

    print("\n✅ In-place optimization complete (backups created)")

if __name__ == "__main__":
    main()
