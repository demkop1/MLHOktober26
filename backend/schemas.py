from typing import Literal, Optional

from pydantic import BaseModel, Field

Status = Literal["low", "normal", "high", "abnormal", "info"]
OverallStatus = Literal["reassuring", "some_attention", "needs_attention"]


# ---- LLM structured-output schemas -------------------------------------------------

class RawConcept(BaseModel):
    name: str = Field(description="Test or term exactly as written in the report")
    value: Optional[str] = Field(None, description="Measured result, null if the item has no value")
    unit: Optional[str] = None
    reference_range: Optional[str] = Field(None, description="Reference range as written, e.g. '4.0 - 10.0' or '< 5.0'")
    flag: Optional[Status] = Field(None, description="low/normal/high/abnormal/info if stated or obvious")


class Extraction(BaseModel):
    is_lab_report: bool
    title: str = Field(description="Short name of the report, e.g. 'Complete Blood Count'")
    language: str = Field(description="English name of the report's language, e.g. 'German'")
    concepts: list[RawConcept]


class Explanation(BaseModel):
    plain_name: str = Field(description="Friendly everyday name for the test or term")
    explanation: str = Field(description="One or two plain sentences: what it is")
    why_it_matters: str = Field(description="One or two plain sentences: what THIS result may mean")


class ExplanationBatch(BaseModel):
    items: list[Explanation] = Field(description="One explanation per input item, in the same order")


class Summary(BaseModel):
    title: str = Field(description="Short name of the report, e.g. 'Blood count and iron'")
    summary: str = Field(description="3-5 sentence overall explanation")
    key_takeaways: list[str] = Field(description="2-5 short bullet points")
    questions_for_doctor: list[str] = Field(description="3-5 helpful questions")


# ---- API schemas (mirror frontend/src/lib/report-schema.ts) -------------------------

class Concept(BaseModel):
    name: str
    value: Optional[str]
    unit: Optional[str]
    reference_range: Optional[str]
    status: Status
    plain_name: str
    explanation: str
    why_it_matters: str


class Interpretation(BaseModel):
    is_lab_report: bool
    title: str
    overall_status: OverallStatus
    summary: str
    key_takeaways: list[str]
    concepts: list[Concept]
    questions_for_doctor: list[str]


class InterpretRequest(BaseModel):
    text: Optional[str] = None
    # data URL (image/* or application/pdf)
    file: Optional[str] = None
