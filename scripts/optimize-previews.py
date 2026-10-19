"""Create smaller front-page previews without changing original project assets.

Run from the repository root with Pillow installed:
    python3 scripts/optimize-previews.py
"""

from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path

from PIL import Image, ImageOps


class PreviewSources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.sources = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for key in ("data-quick-view", "data-spatial-image"):
            self.sources.update(filter(None, attrs.get(key, "").split("|")))
        if tag == "img" and attrs.get("src"):
            self.sources.add(attrs["src"])


def optimize(source):
    original = Path(source)
    if original.suffix.lower() not in (".png", ".jpg", ".jpeg"):
        return None
    preview = original.with_name(original.stem + ".preview.webp")
    with Image.open(original) as image:
        image = ImageOps.exif_transpose(image)
        image.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        image.save(preview, "WEBP", quality=88, method=5,
                   icc_profile=image.info.get("icc_profile", b""))
    if preview.stat().st_size >= original.stat().st_size * 0.9:
        preview.unlink()
        return None
    return source, preview.as_posix()


page = Path("index.html")
html = page.read_text()
parser = PreviewSources()
parser.feed(html)
sources = sorted(source for source in parser.sources if Path(source).is_file())
before = sum(Path(source).stat().st_size for source in sources)
with ThreadPoolExecutor(max_workers=3) as pool:
    replacements = dict(result for result in pool.map(optimize, sources) if result)
for original, preview in replacements.items():
    html = html.replace(original, preview)
page.write_text(html)
after = sum(Path(replacements.get(source, source)).stat().st_size for source in sources)
print(f"Optimized {len(replacements)} previews: {before / 1e6:.1f} MB → {after / 1e6:.1f} MB")
print("Original files preserved; only front-page references changed.")
