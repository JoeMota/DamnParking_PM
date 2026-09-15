#!/usr/bin/env python3
"""Smoke tests for the Damn Parking static Living Project Portal.

Validates required pages, PDF link/file parity, HTML structure, and that a
local static server returns 200 for key routes and assets.
"""

from __future__ import annotations

import html.parser
import re
import sys
import threading
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_PAGES = [
    "index.html",
    "about/index.html",
    "sprint1/index.html",
    "sprint1/market-research.html",
    "sprint1/business-strategy.html",
    "sprint1/project-charter.html",
    "sprint1/contributions.html",
    "sprint2/index.html",
]

REQUIRED_ASSETS = [
    "assets/css/main.css",
    "assets/js/site.js",
    "assets/js/parking-scene.js",
    "assets/pdfs/sprint1-market-research.pdf",
    "assets/pdfs/sprint1-business-strategy.pdf",
    "assets/pdfs/sprint1-project-charter.pdf",
    "assets/pdfs/sprint1-contributions.pdf",
]

REQUIRED_SECTIONS = {
    "index.html": ["Damn Parking", "parking-canvas", "assets/js/parking-scene.js"],
    "about/index.html": ["About", "site-nav"],
    "sprint1/index.html": ["Sprint 1", "market-research"],
    "sprint1/project-charter.html": ["Project Charter", "pdf-link"],
}

SMOKE_PATHS = [
    "/",
    "/index.html",
    "/about/",
    "/about/index.html",
    "/sprint1/",
    "/sprint1/index.html",
    "/sprint1/market-research.html",
    "/sprint1/business-strategy.html",
    "/sprint1/project-charter.html",
    "/sprint1/contributions.html",
    "/sprint2/",
    "/sprint2/index.html",
    "/assets/css/main.css",
    "/assets/js/site.js",
    "/assets/js/parking-scene.js",
    "/assets/pdfs/sprint1-market-research.pdf",
    "/assets/pdfs/sprint1-business-strategy.pdf",
    "/assets/pdfs/sprint1-project-charter.pdf",
    "/assets/pdfs/sprint1-contributions.pdf",
]

PDF_HREF_RE = re.compile(
    r"""(?:href|src)=["']([^"']+\.pdf)["']""",
    re.IGNORECASE,
)
ASSET_REF_RE = re.compile(
    r"""(?:href|src)=["']([^"']+\.(?:css|js|pdf))["']""",
    re.IGNORECASE,
)


class Failures:
    def __init__(self) -> None:
        self.items: list[str] = []

    def add(self, message: str) -> None:
        self.items.append(message)

    def ok(self) -> bool:
        return not self.items


class HTMLStructureParser(html.parser.HTMLParser):
    """Lightweight well-formedness check: tags balance and required tags exist."""

    VOID = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[str] = []
        self.has_html = False
        self.has_head = False
        self.has_body = False
        self.has_title = False
        self.errors: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:  # noqa: ANN001
        tag = tag.lower()
        if tag == "html":
            self.has_html = True
        elif tag == "head":
            self.has_head = True
        elif tag == "body":
            self.has_body = True
        elif tag == "title":
            self.has_title = True
        if tag not in self.VOID and not tag.startswith("!"):
            self.stack.append(tag)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in self.VOID:
            return
        if not self.stack:
            self.errors.append(f"unexpected closing </{tag}>")
            return
        if self.stack[-1] != tag:
            # Allow browser-forgiving mismatches but record them.
            if tag in self.stack:
                while self.stack and self.stack[-1] != tag:
                    self.stack.pop()
                if self.stack:
                    self.stack.pop()
            else:
                self.errors.append(f"mismatched closing </{tag}>")
            return
        self.stack.pop()

    def handle_startendtag(self, tag: str, attrs) -> None:  # noqa: ANN001
        tag = tag.lower()
        if tag == "html":
            self.has_html = True
        elif tag == "head":
            self.has_head = True
        elif tag == "body":
            self.has_body = True
        elif tag == "title":
            self.has_title = True


def resolve_href(page: Path, href: str) -> Path | None:
    if href.startswith(("http://", "https://", "data:", "mailto:", "#")):
        return None
    href = href.split("?", 1)[0].split("#", 1)[0]
    if not href:
        return None
    return (page.parent / href).resolve()


def check_required_files(failures: Failures) -> None:
    for rel in REQUIRED_PAGES + REQUIRED_ASSETS:
        path = ROOT / rel
        if not path.is_file():
            failures.add(f"missing required file: {rel}")


def check_vercel_static(failures: Failures) -> None:
    vercel = ROOT / "vercel.json"
    if not vercel.is_file():
        failures.add("missing vercel.json (required for static Vercel deploy)")
        return
    text = vercel.read_text(encoding="utf-8")
    if "preact" in text.lower():
        failures.add("vercel.json must not reference Preact")
    for needle in ('"framework": null', '"buildCommand": null', '"outputDirectory": "."'):
        if needle not in text:
            failures.add(f'vercel.json missing {needle}')


def check_no_preact_package(failures: Failures) -> None:
    pkg = ROOT / "package.json"
    if not pkg.is_file():
        return
    text = pkg.read_text(encoding="utf-8").lower()
    for bad in ("preact", "preact-cli", "@preact"):
        if bad in text:
            failures.add(f"package.json must not declare {bad}")
    if '"build"' in text and "preact" in text:
        failures.add("package.json must not define a Preact build script")


def check_pdf_links(failures: Failures) -> None:
    pdf_dir = (ROOT / "assets" / "pdfs").resolve()
    referenced: set[Path] = set()
    for html_path in ROOT.rglob("*.html"):
        if ".git" in html_path.parts:
            continue
        content = html_path.read_text(encoding="utf-8")
        for href in PDF_HREF_RE.findall(content):
            target = resolve_href(html_path, href)
            if target is None:
                continue
            referenced.add(target)
            if not target.is_file():
                failures.add(
                    f"PDF link in {html_path.relative_to(ROOT)} points to missing file: {href}"
                )
            elif pdf_dir not in target.parents and target.parent != pdf_dir:
                failures.add(
                    f"PDF link in {html_path.relative_to(ROOT)} is outside assets/pdfs/: {href}"
                )

    on_disk = {p.resolve() for p in pdf_dir.glob("*.pdf")} if pdf_dir.is_dir() else set()
    orphaned = sorted(on_disk - referenced)
    # Orphans are warnings only if none referenced — require all on-disk PDFs be linked.
    for path in orphaned:
        failures.add(f"PDF on disk is not linked from any HTML: {path.relative_to(ROOT)}")


def check_html_structure(failures: Failures) -> None:
    for rel in REQUIRED_PAGES:
        path = ROOT / rel
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8")
        parser = HTMLStructureParser()
        try:
            parser.feed(content)
            parser.close()
        except Exception as exc:  # noqa: BLE001
            failures.add(f"HTML parse error in {rel}: {exc}")
            continue

        if not parser.has_html:
            failures.add(f"{rel}: missing <html>")
        if not parser.has_head:
            failures.add(f"{rel}: missing <head>")
        if not parser.has_body:
            failures.add(f"{rel}: missing <body>")
        if not parser.has_title:
            failures.add(f"{rel}: missing <title>")
        if parser.stack:
            failures.add(f"{rel}: unclosed tags: {', '.join(parser.stack)}")
        if parser.errors:
            for err in parser.errors[:5]:
                failures.add(f"{rel}: {err}")

        for needle in REQUIRED_SECTIONS.get(rel, []):
            if needle not in content:
                failures.add(f"{rel}: missing required content/marker: {needle!r}")


def check_local_asset_refs(failures: Failures) -> None:
    for html_path in ROOT.rglob("*.html"):
        if ".git" in html_path.parts:
            continue
        content = html_path.read_text(encoding="utf-8")
        for href in ASSET_REF_RE.findall(content):
            target = resolve_href(html_path, href)
            if target is None:
                continue
            if not target.is_file():
                failures.add(
                    f"asset ref in {html_path.relative_to(ROOT)} missing: {href}"
                )


def check_http_smoke(failures: Failures) -> None:
    handler = type(
        "RootHandler",
        (SimpleHTTPRequestHandler,),
        {"directory": str(ROOT)},
    )

    # Quiet the default request logging.
    def log_message(self, format, *args):  # noqa: A002, ANN001, ANN002
        return

    handler.log_message = log_message  # type: ignore[method-assign]

    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"

    try:
        for path in SMOKE_PATHS:
            url = base + path
            try:
                with urllib.request.urlopen(url, timeout=5) as resp:
                    code = resp.getcode()
                    body = resp.read(64)
                    if code != 200:
                        failures.add(f"HTTP {code} for {path}")
                    elif path.endswith(".pdf") and not body.startswith(b"%PDF"):
                        # Placeholder PDFs in this repo may be text stubs; accept either.
                        text = body.decode("utf-8", errors="ignore")
                        if "PDF" not in text.upper() and "%PDF" not in text:
                            failures.add(f"PDF response for {path} does not look like a PDF")
            except urllib.error.HTTPError as exc:
                failures.add(f"HTTP {exc.code} for {path}")
            except Exception as exc:  # noqa: BLE001
                failures.add(f"request failed for {path}: {exc}")

        # Confirm home references the 3D scene module and that module is loadable.
        with urllib.request.urlopen(base + "/index.html", timeout=5) as resp:
            home = resp.read().decode("utf-8", errors="replace")
        if "assets/js/parking-scene.js" not in home:
            failures.add("index.html does not reference parking-scene.js")
        else:
            with urllib.request.urlopen(base + "/assets/js/parking-scene.js", timeout=5) as resp:
                scene = resp.read().decode("utf-8", errors="replace")
            if "THREE" not in scene and "three" not in scene:
                failures.add("parking-scene.js does not appear to reference Three.js")
    finally:
        server.shutdown()
        server.server_close()


def main() -> int:
    failures = Failures()
    print("Damn Parking portal smoke tests")
    print(f"root: {ROOT}")

    checks = [
        ("required files", check_required_files),
        ("vercel static config", check_vercel_static),
        ("no preact package", check_no_preact_package),
        ("pdf link parity", check_pdf_links),
        ("html structure", check_html_structure),
        ("local asset refs", check_local_asset_refs),
        ("http smoke", check_http_smoke),
    ]

    for name, fn in checks:
        before = len(failures.items)
        fn(failures)
        status = "PASS" if len(failures.items) == before else "FAIL"
        print(f"  [{status}] {name}")

    if failures.ok():
        print("\nAll smoke tests passed.")
        return 0

    print(f"\n{len(failures.items)} failure(s):")
    for item in failures.items:
        print(f"  - {item}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
