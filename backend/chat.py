"""RAG chat over a lab report: chunk -> embed (Ollama) -> retrieve top-k -> MedGemma answers from them."""
import hashlib
import math
import os
import re

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_ollama import OllamaEmbeddings

from graph import OLLAMA_URL, llm
from schemas import ChatMessage

EMBED_MODEL = os.getenv("EMBED_MODEL", "qwen3-embedding:0.6b")
TOP_K = int(os.getenv("CHAT_TOP_K", "5"))
CHUNK_CHARS = 600
HISTORY_TURNS = 6  # last messages sent back to the model
CACHE_SIZE = 8

embedder = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_URL)

# Reports are re-sent with each question (the API is stateless), so embeddings are cached by text hash.
_index_cache: dict[str, tuple[list[str], list[list[float]]]] = {}

CHAT_SYS = """You help a patient understand their own lab report. Answer ONLY from the report excerpts you are given.
- If the excerpts do not contain the answer, say so plainly and suggest asking their doctor. Do not guess values.
- Use simple everyday language, short paragraphs, and quote the relevant values with their units and reference ranges.
- Never diagnose or recommend treatment; explain what results may mean and encourage discussing them with their doctor.
- Reply in the language the patient writes in."""


def _final_answer(content: str) -> str:
    """MedGemma sometimes prints its reasoning first, then a <unusedNN> marker, then the real answer."""
    parts = re.split(r"<unused\d+>", content)
    return next((p.strip() for p in reversed(parts) if p.strip()), "")


def chunk_text(text: str) -> list[str]:
    """Group consecutive lines into ~CHUNK_CHARS chunks, repeating the last line for context."""
    chunks, cur = [], []
    for line in (ln.strip() for ln in text.splitlines()):
        if not line:
            continue
        if cur and sum(len(x) + 1 for x in cur) + len(line) > CHUNK_CHARS:
            chunks.append("\n".join(cur))
            cur = cur[-1:]
        cur.append(line)
    if cur:
        chunks.append("\n".join(cur))
    return chunks


def _index(text: str) -> tuple[list[str], list[list[float]]]:
    key = hashlib.sha256(text.encode()).hexdigest()
    if key not in _index_cache:
        chunks = chunk_text(text)
        _index_cache[key] = (chunks, embedder.embed_documents(chunks))
        while len(_index_cache) > CACHE_SIZE:
            _index_cache.pop(next(iter(_index_cache)))
    return _index_cache[key]


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)) or 1)


def retrieve(text: str, query: str, k: int = TOP_K) -> list[str]:
    chunks, vectors = _index(text)
    q = embedder.embed_query(query)
    ranked = sorted(range(len(chunks)), key=lambda i: _cosine(q, vectors[i]), reverse=True)[:k]
    return [chunks[i] for i in sorted(ranked)]  # report order reads better than score order


def answer(text: str, messages: list[ChatMessage]) -> tuple[str, list[str]]:
    """`messages` ends with the user's new question. Returns (answer, retrieved excerpts)."""
    question = messages[-1].content
    # Follow-ups like "and what about that one?" retrieve better with the previous question attached.
    prior_user = [m.content for m in messages[:-1] if m.role == "user"][-1:]
    sources = retrieve(text, "\n".join(prior_user + [question]))

    history = [HumanMessage(m.content) if m.role == "user" else AIMessage(m.content)
               for m in messages[:-1][-HISTORY_TURNS:]]
    context = "\n---\n".join(sources)
    final = HumanMessage(f"Report excerpts:\n{context}\n\nQuestion: {question}\n\n"
                         "(Answer in the same language as the question above, not the language of the excerpts.)")
    reply = llm.invoke([SystemMessage(CHAT_SYS), *history, final])
    return _final_answer(str(reply.content)), sources
