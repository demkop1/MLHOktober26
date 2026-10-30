"""LangGraph pipeline:  prepare -> (fan out) explain batches -> summarize.

Table rows are parsed deterministically when possible; MedGemma extracts them only
for photos / free text. Statuses are computed from value vs. range, not by the LLM.
"""
import operator
import os
from typing import Annotated, Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_ollama import ChatOllama
from langdetect import DetectorFactory, detect
from langgraph.graph import END, START, StateGraph
from langgraph.types import Send

from ranges import compute_status, parse_rows
from schemas import (Concept, Explanation, ExplanationBatch, Extraction, Interpretation,
                     RawConcept, Summary)

MODEL = os.getenv("MEDGEMMA_MODEL", "medgemma1.5:4b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MAX_CONCEPTS = int(os.getenv("MAX_CONCEPTS", "60"))
BATCH_SIZE = int(os.getenv("EXPLAIN_BATCH", "5"))
DetectorFactory.seed = 0

llm = ChatOllama(model=MODEL, base_url=OLLAMA_URL, temperature=0)

LANGS = {"de": "German", "en": "English", "fr": "French", "es": "Spanish", "it": "Italian",
         "uk": "Ukrainian", "ru": "Russian", "pl": "Polish", "tr": "Turkish", "nl": "Dutch"}


def lang_rule(language: str) -> str:
    return f"Write ALL output text in {language}, the language of the lab report."


EXTRACT_SYS = """You read laboratory reports and extract their content as structured data.
- is_lab_report: false if the input is clearly not a medical/lab report.
- title: short name of the report. language: English name of the report's language.
- concepts: one entry per test/marker row, in report order, none skipped. Copy name, value, unit and reference range exactly as written.
  Also add notable medical terms or findings without a number (e.g. a comment like "Eosinophilia") with value null.
  Skip headers, patient data, dates, doctor names and boilerplate.
Do not invent anything that is not in the report."""

EXPLAIN_SYS = """You explain lab tests and medical terms to a patient with no medical background (8th-grade reading level).
For EACH item you are given, in the same order, return:
- plain_name: friendly everyday name.
- explanation: ONE or TWO short sentences on what it is.
- why_it_matters: ONE or TWO short sentences on what this patient's result may mean, using the status given. If normal, say it is reassuring.
Never diagnose; be calm and non-alarming. {lang}"""

SUMMARY_SYS = """You are a patient-friendly medical explainer. You get the results of a lab report with their status.
Give a short title, a warm plain-language overall summary (3-5 sentences), 2-5 short key takeaways focused on abnormal results,
and 3-5 useful questions to ask the doctor. Never diagnose; encourage discussing results with the doctor. {lang}"""


class State(TypedDict, total=False):
    text: str
    image: Optional[str]
    is_lab_report: bool
    title: str
    language: str
    concepts: list[RawConcept]
    explained: Annotated[list[tuple[int, Concept]], operator.add]
    result: Interpretation


def prepare(state: State) -> State:
    """Get the concept list: regex for clean tables, MedGemma for photos / free text."""
    text = state.get("text", "")
    rows = parse_rows(text)
    if len(rows) >= 3 and not state.get("image"):
        try:
            language = LANGS.get(detect(text), "English")
        except Exception:
            language = "English"
        return {"is_lab_report": True, "language": language,
                "concepts": [RawConcept(**r) for r in rows][:MAX_CONCEPTS]}

    prompt = f"Lab report:\n\n{text}" if text else "Here is a photo of my lab report."
    content: list = [{"type": "text", "text": prompt}]
    if state.get("image"):
        content.append({"type": "image_url", "image_url": state["image"]})
    out: Extraction = llm.with_structured_output(Extraction, method="json_schema").invoke(
        [SystemMessage(EXTRACT_SYS), HumanMessage(content)]
    )
    return {"is_lab_report": out.is_lab_report, "title": out.title, "language": out.language or "English",
            "concepts": out.concepts[:MAX_CONCEPTS]}


def fan_out(state: State):
    concepts = state.get("concepts") or []
    if not state.get("is_lab_report") or not concepts:
        return "finish"
    return [
        Send("explain", {"start": i, "concepts": concepts[i:i + BATCH_SIZE], "language": state["language"]})
        for i in range(0, len(concepts), BATCH_SIZE)
    ]


def _status(c: RawConcept) -> str:
    return compute_status(c.value, c.reference_range) or c.flag or ("info" if c.value is None else "normal")


def _describe(c: RawConcept) -> str:
    return (f"Name: {c.name} | Value: {c.value or 'n/a'} {c.unit or ''} | "
            f"Reference range: {c.reference_range or 'n/a'} | Status: {_status(c)}")


def _explain_batch(concepts: list[RawConcept], language: str) -> list[Explanation]:
    sys = SystemMessage(EXPLAIN_SYS.format(lang=lang_rule(language)))
    items = "\n".join(f"{i + 1}. {_describe(c)}" for i, c in enumerate(concepts))
    out: ExplanationBatch = llm.with_structured_output(ExplanationBatch, method="json_schema").invoke(
        [sys, HumanMessage(items)]
    )
    if len(out.items) == len(concepts):
        return out.items
    # Small models sometimes drop/merge items: redo one by one.
    singles = []
    for c in concepts:
        r = llm.with_structured_output(ExplanationBatch, method="json_schema").invoke([sys, HumanMessage(f"1. {_describe(c)}")])
        singles.append(r.items[0])
    return singles


def explain(payload: dict) -> State:
    concepts: list[RawConcept] = payload["concepts"]
    exps = _explain_batch(concepts, payload["language"])
    done = [
        (payload["start"] + i, Concept(
            name=c.name, value=c.value, unit=c.unit, reference_range=c.reference_range, status=_status(c),
            plain_name=e.plain_name, explanation=e.explanation, why_it_matters=e.why_it_matters))
        for i, (c, e) in enumerate(zip(concepts, exps))
    ]
    return {"explained": done}


def _overall(concepts: list[Concept]) -> str:
    flagged = sum(c.status in ("low", "high", "abnormal") for c in concepts)
    return "reassuring" if flagged == 0 else "some_attention" if flagged <= 3 else "needs_attention"


def summarize(state: State) -> State:
    concepts = [c for _, c in sorted(state["explained"], key=lambda t: t[0])]
    # Only abnormal rows + a count keep the prompt small for the 4B model.
    flagged = [c for c in concepts if c.status in ("low", "high", "abnormal")]
    lines = "\n".join(f"- {c.name}: {c.value} {c.unit or ''} (ref {c.reference_range}) -> {c.status}" for c in flagged) or "- none"
    prompt = f"{len(concepts)} results in total, {len(flagged)} outside the reference range.\nOutside range:\n{lines}"
    if state.get("title"):
        prompt = f"Report: {state['title']}\n{prompt}"
    s: Summary = llm.with_structured_output(Summary, method="json_schema").invoke(
        [SystemMessage(SUMMARY_SYS.format(lang=lang_rule(state["language"]))), HumanMessage(prompt)]
    )
    return {"result": Interpretation(
        is_lab_report=True, title=state.get("title") or s.title, overall_status=_overall(concepts),
        summary=s.summary, key_takeaways=s.key_takeaways, concepts=concepts,
        questions_for_doctor=s.questions_for_doctor,
    )}


def finish(state: State) -> State:
    """Input wasn't a lab report (or nothing extractable)."""
    return {"result": Interpretation(
        is_lab_report=False, title=state.get("title") or "", overall_status="reassuring", summary="",
        key_takeaways=[], concepts=[], questions_for_doctor=[],
    )}


builder = StateGraph(State)
builder.add_node("prepare", prepare)
builder.add_node("explain", explain)
builder.add_node("summarize", summarize)
builder.add_node("finish", finish)
builder.add_edge(START, "prepare")
builder.add_conditional_edges("prepare", fan_out, ["explain", "finish"])
builder.add_edge("explain", "summarize")
builder.add_edge("summarize", END)
builder.add_edge("finish", END)
graph = builder.compile()
