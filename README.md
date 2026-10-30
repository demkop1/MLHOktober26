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

## Run the frontend

```bash
cd frontend
bun install
bun run dev
```

Open the URL Vite prints (usually http://localhost:5173).

The frontend sends reports to `POST /api/interpret` on a backend at `http://localhost:8001`
(override with `VITE_API_URL`). That backend is not in this repo yet, so until it is added
the UI will show "Can't reach the LabLens server".

Other frontend commands: `bun run build`, `bun run lint`, `bun run test`.
