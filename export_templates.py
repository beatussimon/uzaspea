import os

TEMPLATES_DIR = "marketplace/templates"
OUTPUT_FILE = "all_templates.txt"

with open(OUTPUT_FILE, "w", encoding="utf-8") as out:
    for root, _, files in os.walk(TEMPLATES_DIR):
        for file in files:
            if file.endswith((".html", ".txt")):
                file_path = os.path.join(root, file)

                out.write("=" * 80 + "\n")
                out.write(f"FILE: {file_path}\n")
                out.write("=" * 80 + "\n\n")

                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        out.write(f.read())
                except Exception as e:
                    out.write(f"[ERROR READING FILE]: {e}")

                out.write("\n\n")

print(f"✅ Templates exported to {OUTPUT_FILE}")

