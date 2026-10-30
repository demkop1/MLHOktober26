import os
import shutil
import subprocess
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool

from documents import prepare_input
from graph import MODEL, graph
from schemas import InterpretRequest, Interpretation

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
API_PORT = int(os.getenv("API_PORT", "8001"))
FRONTEND_PORT = int(os.getenv("FRONTEND_PORT", "5173"))


def start_frontend():
    """Run the Vite dev server for the frontend alongside the API."""
    bun = shutil.which("bun")
    if not bun:
        print("bun not found - install it (brew install oven-sh/bun/bun). Frontend not started.")
        return None
    if not (FRONTEND_DIR / "node_modules").exists():
        subprocess.run([bun, "install"], cwd=FRONTEND_DIR, check=True)
    env = {**os.environ, "VITE_API_URL": f"http://localhost:{API_PORT}"}
    print(f"\n  LabLens: http://localhost:{FRONTEND_PORT}\n")
    return subprocess.Popen(
        [bun, "run", "dev", "--port", str(FRONTEND_PORT), "--strictPort"], cwd=FRONTEND_DIR, env=env
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    frontend = start_frontend()
    try:
        yield
    finally:
        if frontend:
            frontend.terminate()


app = FastAPI(title="LabLens API", lifespan=lifespan)
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
        out = await run_in_threadpool(graph.invoke, {"text": text, "image": image, "instructions": (req.instructions or "").strip()})
    except Exception as e:  # Ollama down, model missing, bad structured output...
        raise HTTPException(502, f"The AI couldn't read this report ({type(e).__name__}). Please try again.")
    return out["result"]


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=API_PORT)
