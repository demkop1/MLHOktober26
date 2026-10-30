import base64
import io
from typing import Optional

from pypdf import PdfReader


def split_data_url(data_url: str) -> tuple[str, bytes]:
    header, _, b64 = data_url.partition(",")
    mime = header.removeprefix("data:").split(";")[0]
    return mime, base64.b64decode(b64)


def pdf_to_text(raw: bytes) -> str:
    reader = PdfReader(io.BytesIO(raw))
    return "\n".join(page.extract_text() or "" for page in reader.pages).strip()


def prepare_input(text: Optional[str], file: Optional[str]) -> tuple[str, Optional[str]]:
    """Return (text, image_data_url). PDFs become text; images go to the multimodal model."""
    text = (text or "").strip()
    image = None
    if file:
        mime, raw = split_data_url(file)
        if mime == "application/pdf":
            pdf_text = pdf_to_text(raw)
            if not pdf_text:
                raise ValueError("This PDF has no readable text (scanned?). Upload a photo of it instead.")
            text = f"{text}\n\n{pdf_text}".strip()
        elif mime.startswith("image/"):
            image = file
        else:
            raise ValueError(f"Unsupported file type: {mime}")
    return text, image
