# MLHOktober26


## Run

```bash
# 1. MedGemma via Ollama (model: medgemma1.5:4b)
ollama serve

# 2. Backend: FastAPI + LangGraph  ->  http://localhost:8001
source .venv/bin/activate && pip install -r requirements.txt
cd backend && uvicorn main:app --port 8001

# 3. Frontend  ->  http://localhost:3000 (set VITE_API_URL to change the API address)
cd frontend && npm install --legacy-peer-deps && npm run dev
```

Pipeline (`backend/graph.py`): `prepare` (table parser, MedGemma extraction for photos) -> `explain` (parallel batches, 1-2 sentence explanations) -> `summarize`. Statuses (low/normal/high) are computed in code from value vs. reference range.
