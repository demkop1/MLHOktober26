import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool

from documents import prepare_input
from graph import MODEL, graph
from schemas import InterpretRequest, Interpretation

app = FastAPI(title="LabLens API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:8080").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok", "model": MODEL}


@app.post("/api/interpret", response_model=Interpretation)
async def interpret(req: InterpretRequest):
    try:
        text, image = prepare_input(req.text, req.file)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not text and not image:
        raise HTTPException(400, "Please provide a report.")
    try:
        out = await run_in_threadpool(graph.invoke, {"text": text, "image": image})
    except Exception as e:  # Ollama down, model missing, bad structured output...
        raise HTTPException(502, f"The AI couldn't read this report ({type(e).__name__}). Please try again.")
    return out["result"]
