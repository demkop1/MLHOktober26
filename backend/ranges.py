"""Deterministic value-vs-reference-range check, so flags don't depend on a small LLM."""
import re
from typing import Optional

_NUM = r"(\d+(?:[.,]\d+)?)"


def _num(s: str) -> float:
    return float(s.replace(",", "."))


def compute_status(value: Optional[str], reference_range: Optional[str]) -> Optional[str]:
    """Return low/normal/high, or None if value or range can't be parsed."""
    if not value or not reference_range:
        return None
    m = re.search(_NUM, value)
    if not m:
        return None
    v = _num(m.group(1))
    r = reference_range.replace("–", "-").replace("—", "-").replace("≤", "<=").replace("≥", ">=")

    if m := re.search(rf"{_NUM}\s*-\s*{_NUM}", r):
        lo, hi = _num(m.group(1)), _num(m.group(2))
        return "low" if v < lo else "high" if v > hi else "normal"
    if m := re.search(rf"(<=?)\s*{_NUM}", r):
        hi = _num(m.group(2))
        return "high" if (v > hi if m.group(1) == "<=" else v >= hi) else "normal"
    if m := re.search(rf"(>=?)\s*{_NUM}", r):
        lo = _num(m.group(2))
        return "low" if (v < lo if m.group(1) == ">=" else v <= lo) else "normal"
    return None


_ROW = re.compile(
    r"^(?P<name>[^\d()<>][^()]*?[A-Za-zÀ-ÿ][^()]*?)\s+"
    r"(?P<value>[<>]?\s?\d+(?:[.,]\d+)?)"
    r"(?:\s+(?P<unit>[^\s()]+))?\s+"
    r"\((?P<range>[^)]*\d[^)]*)\)\s*(?P<flag>[A-Za-z*+-]{1,2})?\s*$"
)


def parse_rows(text: str) -> list[dict]:
    """Parse 'Name  value  unit  (range)' table lines. Returns [] for unstructured text."""
    rows = []
    for line in text.splitlines():
        if m := _ROW.match(line.strip()):
            rows.append({
                "name": m["name"].strip(), "value": m["value"].replace(" ", ""),
                "unit": m["unit"], "reference_range": m["range"].strip(),
            })
    return rows
