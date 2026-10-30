# MLHOktober26

Lab report interpretation (LabLens) using MedGemma.

- `gemma/` – Python demo that queries MedGemma through Ollama
- `frontend/` – web UI (Vite + React, uses bun)
- `lab_results/` – sample anonymised lab report PDFs

## Prerequisites

- [conda](https://docs.conda.io/)
- [Ollama](https://ollama.com/) with the model pulled: `ollama pull medgemma1.5:4b`
- [bun](https://bun.sh/) (frontend only)

## Python setup

```bash
conda create -n mlhackathon26 python=3.12 pip -y
conda activate mlhackathon26
pip install -r requirements.txt
```

## Run the Gemma demo

Make sure Ollama is running (`ollama serve`, or the desktop app), then:

```bash
conda activate mlhackathon26
python gemma/demo.py
```

It sends one question to `medgemma1.5:4b` at `http://localhost:11434` and prints the answer.

## Run the app

```bash
conda activate mlhackathon26
python backend/main.py
```

This starts the API on http://localhost:8001 and also launches the frontend (Vite dev server,
installing its dependencies with bun on first run). Open **http://localhost:5173**.

In the UI, pick a tab, in this order:

1. **Upload PDF / photo** – a lab report PDF (or a photo of one)
2. **Paste text** – paste the report text
3. **Additional instructions** – optional guidance for the AI, e.g. "keep it very short" or
   "I'm vegetarian, focus on iron". Applies to whichever report you submit.

Ollama must be running with `medgemma1.5:4b`. Env vars: `API_PORT` (8001), `FRONTEND_PORT` (5173),
`MEDGEMMA_MODEL`, `OLLAMA_URL`.

Frontend-only commands (from `frontend/`): `bun run dev`, `bun run build`, `bun run lint`, `bun run test`.
