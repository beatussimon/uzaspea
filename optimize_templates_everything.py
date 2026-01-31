import os
import re
import shutil

TEMPLATES_DIR = "marketplace/templates"

def balanced_django_tags(text):
    return text.count("{% if") == text.count("{% endif %}")

def optimize_html(content: str) -> str:
    original = content

    # -------------------------------------------------
    # 1. Lazy-load images (skip likely hero images)
    # -------------------------------------------------
    def lazy_img(match):
        tag = match.group(0)
        if any(x in tag.lower() for x in ["carousel", "hero", "banner"]):
            return tag
        if "loading=" in tag:
            return tag
        return tag.replace("<img", '<img loading="lazy"', 1)

    content = re.sub(r"<img[^>]*>", lazy_img, content)

    # -------------------------------------------------
    # 2. Defer external JS (non-inline only)
    # -------------------------------------------------
    content = re.sub(
        r'<script src="([^"]+\.js)"></script>',
        r'<script src="\1" defer></script>',
        content
    )

    # -------------------------------------------------
    # 3. Remove jQuery CDN safely
    # -------------------------------------------------
    content = re.sub(
        r'\s*<script src="https://code\.jquery\.com/jquery-[^"]+"></script>',
        '',
        content
    )

    # -------------------------------------------------
    # 4. Remove duplicate tooltip initializers
    # -------------------------------------------------
    tooltip_pattern = r'document\.querySelectorAll\("\[data-bs-toggle=\'tooltip\'\]"\)'
    matches = list(re.finditer(tooltip_pattern, content))
    if len(matches) > 1:
        # keep first, remove others
        for m in matches[1:]:
            content = content.replace(m.group(0), "")

    # -------------------------------------------------
    # 5. Replace JS hover zoom with CSS (safe)
    # -------------------------------------------------
    content = re.sub(
        r'function\s+enableImageZoom[\s\S]*?}\s*',
        '',
        content
    )

    # -------------------------------------------------
    # 6. NEWSLETTER FIX (GUARDED)
    # -------------------------------------------------
    if "Subscribe to Newsletter" in content and "{% if not user.is_authenticated %}" not in content:
        # Find the nearest enclosing card ONLY
        card_match = re.search(
            r'(<div class="card[^"]*">[\s\S]*?Subscribe to Newsletter[\s\S]*?</div>\s*</div>)',
            content
        )
        if card_match:
            wrapped = (
                "{% if not user.is_authenticated %}\n"
                + card_match.group(1)
                + "\n{% endif %}"
            )
            test_content = content.replace(card_match.group(1), wrapped, 1)

            # SAFETY CHECK
            if balanced_django_tags(test_content):
                content = test_content
            # else → skip silently

    # -------------------------------------------------
    # 7. Mobile card CSS injection (safe, once)
    # -------------------------------------------------
    if "@media (max-width: 768px)" not in content and "</style>" in content:
        mobile_css = """
@media (max-width: 768px) {
  .product-card {
    display: flex;
    flex-direction: column;
  }
  .product-card img {
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }
  .product-card .meta {
    font-size: 0.9rem;
  }
  .product-card .actions {
    display: flex;
    gap: 0.5rem;
  }
}
"""
        content = content.replace("</style>", mobile_css + "\n</style>")

    # -------------------------------------------------
    # 8. Scroll → IntersectionObserver (guarded)
    # -------------------------------------------------
    if "addEventListener('scroll'" in content and "IntersectionObserver" not in content:
        content = content.replace(
            "window.addEventListener('scroll', loadMore);",
            """
const observer = new IntersectionObserver(entries => {
  if (entries[0].isIntersecting) loadMore();
});
observer.observe(document.getElementById('loading-indicator'));
"""
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
                # Final safety check
                if not balanced_django_tags(optimized):
                    print(f"⚠ SKIPPED (unbalanced tags): {path}")
                    continue

                shutil.copy2(path, path + ".bak")
                with open(path, "w", encoding="utf-8") as f:
                    f.write(optimized)
                print(f"✔ Optimized: {path}")
            else:
                print(f"– No change: {path}")

    print("\n✅ All safe optimizations complete")

if __name__ == "__main__":
    main()

