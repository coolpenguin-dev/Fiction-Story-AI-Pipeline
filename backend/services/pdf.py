from io import BytesIO

from pypdf import PdfReader


def extract_text_from_pdf(file_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(file_bytes))
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            parts.append(text.strip())
    combined = "\n\n".join(parts).strip()
    if not combined:
        raise ValueError(
            "No text could be extracted from this PDF. "
            "It may be scanned/image-only — a text-based PDF is required."
        )
    return combined
