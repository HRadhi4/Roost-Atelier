"""Print the CHANGELOG.md section for one version (used by the release job)."""
import pathlib
import sys

version = sys.argv[1]
text = pathlib.Path("CHANGELOG.md").read_text(encoding="utf-8")
notes = ""
for part in text.split("\n## ")[1:]:
    head, _, body = part.partition("\n")
    if head.split()[0] == version:
        notes = body.strip()
        break
print(notes or f"Roost Atelier {version}")
print()
print("**Update:** in HACS open Roost Atelier, tap Update, then restart Home Assistant.")
print()
print("All versions: [CHANGELOG.md](CHANGELOG.md)")
