#!/usr/bin/env python3
"""Build a capped Cloudflare Vectorize NDJSON file for Cook County tax RAG."""

from __future__ import annotations

import argparse
import hashlib
import html.parser
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path


EMBED_MODEL = "@cf/baai/bge-base-en-v1.5"
DEFAULT_MANIFEST = Path("data_sources/cook_county_tax_docs/manifest.json")
DEFAULT_OUTPUT = Path("import/cook_county_tax_doc_vectors.ndjson")


class TextExtractor(html.parser.HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.skip_depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data):
        if not self.skip_depth:
            text = " ".join(data.split())
            if text:
                self.parts.append(text)


def compact_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def fetch_url(url: str) -> tuple[bytes, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "CookCountyTaxCompareRAG/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        content_type = response.headers.get("content-type", "")
        return response.read(), content_type


def pdf_to_text(data: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".pdf") as pdf_file:
        pdf_file.write(data)
        pdf_file.flush()

        try:
            completed = subprocess.run(
                ["pdftotext", "-layout", pdf_file.name, "-"],
                check=True,
                capture_output=True,
                text=True,
            )
            return compact_text(completed.stdout)
        except (FileNotFoundError, subprocess.CalledProcessError):
            pass

        try:
            from pypdf import PdfReader  # type: ignore

            reader = PdfReader(pdf_file.name)
            return compact_text("\n".join(page.extract_text() or "" for page in reader.pages))
        except Exception as exc:
            raise RuntimeError("PDF text extraction requires pdftotext or pypdf") from exc


def html_to_text(data: bytes) -> str:
    parser = TextExtractor()
    parser.feed(data.decode("utf-8", errors="replace"))
    return compact_text(" ".join(parser.parts))


def load_document(entry: dict, manifest_dir: Path) -> str:
    if entry.get("path"):
        path = (manifest_dir / entry["path"]).resolve()
        data = path.read_bytes()
        if path.suffix.lower() == ".pdf":
            return pdf_to_text(data)
        return compact_text(data.decode("utf-8", errors="replace"))

    data, content_type = fetch_url(entry["url"])
    lower_url = entry["url"].lower()
    if "pdf" in content_type.lower() or lower_url.split("?", 1)[0].endswith(".pdf"):
        return pdf_to_text(data)
    return html_to_text(data)


def chunk_text(text: str, max_chars: int, overlap: int) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for word in words:
        additional = len(word) + (1 if current else 0)
        if current and current_len + additional > max_chars:
            chunks.append(" ".join(current))
            overlap_words: list[str] = []
            overlap_len = 0
            for item in reversed(current):
                item_len = len(item) + (1 if overlap_words else 0)
                if overlap_len + item_len > overlap:
                    break
                overlap_words.append(item)
                overlap_len += item_len
            current = list(reversed(overlap_words))
            current_len = len(" ".join(current))

        current.append(word)
        current_len += additional

    if current:
        chunks.append(" ".join(current))
    return chunks


def cloudflare_embed(account_id: str, token: str, texts: list[str]) -> list[list[float]]:
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{EMBED_MODEL}"
    request = urllib.request.Request(
        url,
        data=json.dumps({"text": texts}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        payload = json.loads(response.read().decode("utf-8"))
    result = payload.get("result") or payload
    vectors = result.get("data")
    if not isinstance(vectors, list):
        raise RuntimeError(f"Unexpected Workers AI embedding response: {payload}")
    return vectors


def build_records(manifest: dict, manifest_dir: Path, args) -> list[dict]:
    records: list[dict] = []
    for entry in manifest["documents"]:
        print(f"Reading {entry['id']} - {entry['title']}", file=sys.stderr)
        text = load_document(entry, manifest_dir)
        if len(text) < args.min_chars:
            print(f"Skipping {entry['id']} because extracted text is too short", file=sys.stderr)
            continue

        for index, chunk in enumerate(chunk_text(text, args.chunk_chars, args.overlap_chars)):
            if len(records) >= args.max_chunks:
                return records
            digest = hashlib.sha1(f"{entry['id']}:{index}:{chunk}".encode("utf-8")).hexdigest()[:16]
            records.append({
                "id": f"{entry['id']}-{index}-{digest}"[:64],
                "text": chunk,
                "metadata": {
                    "document_id": entry["id"],
                    "title": entry["title"],
                    "agency": entry.get("agency", ""),
                    "source_type": entry.get("source_type", ""),
                    "url": entry.get("url", ""),
                    "path": entry.get("path", ""),
                    "chunk": index,
                    "text": chunk,
                },
            })
    return records


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--max-chunks", type=int, default=750)
    parser.add_argument("--chunk-chars", type=int, default=1400)
    parser.add_argument("--overlap-chars", type=int, default=180)
    parser.add_argument("--min-chars", type=int, default=300)
    parser.add_argument("--embed-batch-size", type=int, default=40)
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--index-name", default="cook-county-tax-docs")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text())
    records = build_records(manifest, args.manifest.parent, args)

    account_id = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
    token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not account_id or not token:
        print("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to generate embeddings.", file=sys.stderr)
        print(f"Prepared {len(records)} chunks but did not write vectors.", file=sys.stderr)
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w") as output:
        for offset in range(0, len(records), args.embed_batch_size):
            batch = records[offset:offset + args.embed_batch_size]
            vectors = cloudflare_embed(account_id, token, [item["text"] for item in batch])
            for item, values in zip(batch, vectors):
                output.write(json.dumps({
                    "id": item["id"],
                    "values": values,
                    "metadata": item["metadata"],
                }, separators=(",", ":")) + "\n")
            print(f"Embedded {min(offset + len(batch), len(records))}/{len(records)} chunks", file=sys.stderr)

    print(f"Wrote {len(records)} vectors to {args.output}", file=sys.stderr)
    if args.upload:
        subprocess.run(
            ["npx", "wrangler", "vectorize", "insert", args.index_name, "--file", str(args.output)],
            check=True,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
